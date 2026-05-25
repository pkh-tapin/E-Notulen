import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface FormData {
  judul: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string;
  tempat: string;
  pimpinan_rapat: string;
  notulis: string;
  peserta: string;
  agenda: string;
  isi_notulen: string;
  kesimpulan: string;
  tindak_lanjut: string;
  status: string;
  raw_transcript: string;
}

export default function TambahNotulen() {
  const router = useRouter();
  const { edit } = router.query;
  const isEdit = !!edit;

  // Mendapatkan waktu saat ini sesuai zona waktu lokal pengguna (WITA / GMT+8)
  const getLocalDateString = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  };
  
  const getLocalTimeString = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  const [form, setForm] = useState<FormData>({
    judul: '', 
    tanggal: '', 
    waktu_mulai: '', 
    waktu_selesai: '',
    tempat: '', 
    pimpinan_rapat: '', 
    notulis: '', 
    peserta: '',
    agenda: '', 
    isi_notulen: '', 
    kesimpulan: '', 
    tindak_lanjut: '',
    status: 'draft', 
    raw_transcript: ''
  });

  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Inisialisasi waktu otomatis untuk entri baru, atau load data jika mode Edit
  useEffect(() => {
    if (edit) {
      fetch(`/api/notulen?id=${edit}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.id) setForm(d);
        })
        .catch(console.error);
    } else {
      // Set default ke waktu lokal (Banjarmasin WITA)
      setForm(prev => ({
        ...prev,
        tanggal: getLocalDateString(),
        waktu_mulai: getLocalTimeString()
      }));
    }
  }, [edit]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'info' }), 4000);
  };

  const setField = (key: keyof FormData, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  // --- ENGINE REKAMAN SUARA KUALITAS TINGGI ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
      };

      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      showToast('Gagal mengakses mikrofon. Pastikan izin browser diberikan.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const processAudio = async (blob: Blob) => {
    setAiLoading(true);
    setAiStep('🎙️ Mengamankan berkas audio dan memulai transkripsi...');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const transcribeRes = await fetch('/api/ai?action=transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' })
      });
      const { transcript } = await transcribeRes.json();
      setField('raw_transcript', (form.raw_transcript ? form.raw_transcript + '\n\n' : '') + transcript);

      await processTranscript(transcript);
    } catch (err: any) {
      showToast(`Kesalahan Transkripsi: ${err.message}`, 'error');
      setAiLoading(false);
      setAiStep('');
    }
  };

  // --- ENGINE AI DEFENSIVE PARSER: MENCEGAH JSON MENTAH BOCOR ---
  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt.trim()) {
      showToast('Isi transkrip atau catatan manual terlebih dahulu sebelum menggunakan AI.', 'error');
      return;
    }

    setAiLoading(true);
    setAiStep('🧠 Neural Network sedang merapikan tata letak karya ilmiah...');

    try {
      const res = await fetch('/api/ai?action=process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: txt,
          agenda: form.agenda,
          tempat: form.tempat,
          tanggal: form.tanggal,
          pimpinan: form.pimpinan_rapat
        })
      });
      const rawResult = await res.json();
      
      let parsedData = rawResult;

      // DEFENSE MECHANISM: Jika API mengembalikan string yang berisi JSON (termasuk markdown ```json)
      if (typeof rawResult === 'string' || (rawResult.isi_notulen && typeof rawResult.isi_notulen === 'string' && rawResult.isi_notulen.trim().startsWith('{'))) {
        try {
          // Bersihkan string dari markdown syntax jika ada
          const stringToParse = typeof rawResult === 'string' ? rawResult : rawResult.isi_notulen;
          const cleanString = stringToParse.replace(/```json/gi, '').replace(/```/gi, '').trim();
          const extracted = JSON.parse(cleanString);
          parsedData = typeof rawResult === 'string' ? extracted : { ...rawResult, ...extracted };
        } catch (e) {
          console.warn("Auto-Parser gagal mengekstrak JSON spesifik, menggunakan string utuh.", e);
        }
      }

      setForm(prev => ({
        ...prev,
        judul: parsedData.judul_saran || parsedData.judul || prev.judul,
        isi_notulen: parsedData.isi_notulen || parsedData.isi || prev.isi_notulen,
        kesimpulan: parsedData.kesimpulan || prev.kesimpulan,
        tindak_lanjut: parsedData.tindak_lanjut || parsedData.tindaklanjut || prev.tindak_lanjut,
      }));

      showToast('Notulen berhasil digenerate dan distrukturkan oleh AI!', 'success');
    } catch (err: any) {
      showToast(`Kesalahan AI: ${err.message}`, 'error');
    } finally {
      setAiLoading(false);
      setAiStep('');
    }
  };

  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) {
      showToast('Kolom Judul dan Tanggal Rapat wajib diisi!', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, status: statusOverride || form.status };
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { ...payload, id: edit } : payload;

      const res = await fetch('/api/notulen', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Gagal menyimpan ke database');
      const saved = await res.json();

      showToast('Arsip Notulen berhasil disimpan dengan aman!', 'success');
      setTimeout(() => router.push(`/notulen/${saved.id}`), 1500);
    } catch (err: any) {
      showToast(`Gagal Menyimpan: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{isEdit ? 'Ubah' : 'Buat Baru'} Notulen — NotulenAI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          html, body {
            max-width: 100vw;
            overflow-x: hidden;
            background: linear-gradient(135deg, #0b0f19 0%, #111827 50%, #1e1b4b 100%);
            background-attachment: fixed;
            font-family: 'Inter', sans-serif;
            color: #f3f4f6;
            margin: 0;
            padding: 0;
          }

          .glass-panel { background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
          .glass-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
          .glass-card:hover { border-color: rgba(167, 139, 250, 0.2); box-shadow: 0 15px 35px rgba(139, 92, 246, 0.1); }
          
          .glass-input {
            background: rgba(0, 0, 0, 0.3) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            color: #e5e7eb !important;
            transition: all 0.3s ease;
          }
          .glass-input:focus { border-color: #a78bfa !important; box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.15) !important; outline: none; }
          
          .btn-glossy { background: linear-gradient(135deg, #a78bfa, #6d28d9); box-shadow: 0 4px 15px rgba(109, 40, 217, 0.4); color: white; transition: all 0.2s ease; border: none; }
          .btn-glossy:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(109, 40, 217, 0.6); }
          .btn-glossy:disabled { opacity: 0.6; cursor: not-allowed; }

          .btn-outline { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; transition: all 0.2s ease; }
          .btn-outline:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: white; }

          ::-webkit-scrollbar { height: 6px; width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
          ::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.4); border-radius: 10px; }
          
          .recording-pulse { animation: pulse-red 2s infinite; }
          @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        `}</style>
      </Head>

      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden pb-12">
        {/* Dynamic Toast Notification */}
        {toast.show && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-3 animate-bounce"
            style={{ 
              background: toast.type === 'error' ? 'rgba(153, 27, 27, 0.9)' : toast.type === 'success' ? 'rgba(6, 95, 70, 0.9)' : 'rgba(30, 27, 75, 0.9)', 
              backdropFilter: 'blur(10px)',
              border: `1px solid ${toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#8b5cf6'}`, 
              color: '#fff' 
            }}>
            <span>{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✨' : 'ℹ️'}</span>
            {toast.msg}
          </div>
        )}

        {/* Header Nav */}
        <nav className="glass-panel sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition border border-white/5 text-purple-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
              </Link>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-widest text-purple-400 uppercase">{isEdit ? 'Pembaruan Berkas' : 'Entri Baru'}</span>
                <span className="text-lg font-extrabold tracking-wider text-white">WORKSPACE <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">NOTULEN</span></span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleSave('draft')} disabled={saving} className="btn-outline px-4 py-2 rounded-xl text-xs font-bold tracking-wide hidden sm:block">
                {saving ? 'Menyimpan...' : 'Simpan Draft'}
              </button>
              <button onClick={() => handleSave('final')} disabled={saving} className="btn-glossy px-5 py-2 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '✓'}
                {saving ? 'Proses...' : 'Finalisasi & Simpan'}
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          
          {/* SECTION 1: METADATA RAPAT */}
          <div className="glass-card rounded-3xl p-6 md:p-8">
            <h2 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-fuchsia-300 tracking-widest mb-6 flex items-center gap-3 uppercase">
              <div className="w-2 h-6 rounded-full bg-gradient-to-b from-purple-400 to-fuchsia-500" />
              Informasi Fundamental
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-purple-300/70 text-[10px] font-bold uppercase tracking-widest mb-2">Judul Agenda Rapat *</label>
                <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)}
                  placeholder="Contoh: Rapat Koordinasi Evaluasi Program Kerja..."
                  className="glass-input w-full px-5 py-3 rounded-xl text-sm font-semibold text-white placeholder-white/20" />
              </div>
              {[
                { key: 'tanggal', label: 'Tanggal Pelaksanaan *', type: 'date' },
                { key: 'tempat', label: 'Lokasi / Ruangan', type: 'text', placeholder: 'Contoh: Ruang Rapat Utama' },
                { key: 'waktu_mulai', label: 'Waktu Dimulai', type: 'time' },
                { key: 'waktu_selesai', label: 'Waktu Selesai', type: 'time' },
                { key: 'pimpinan_rapat', label: 'Pimpinan Rapat', type: 'text', placeholder: 'Nama pimpinan...' },
                { key: 'notulis', label: 'Notulis / Sekretaris', type: 'text', placeholder: 'Nama notulis...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-purple-300/70 text-[10px] font-bold uppercase tracking-widest mb-2">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e => setField(f.key as keyof FormData, e.target.value)}
                    placeholder={(f as any).placeholder || ''}
                    className="glass-input w-full px-5 py-3 rounded-xl text-sm text-white placeholder-white/20" />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-purple-300/70 text-[10px] font-bold uppercase tracking-widest mb-2">Daftar Kehadiran Peserta</label>
                <textarea value={form.peserta} onChange={e => setField('peserta', e.target.value)}
                  placeholder="Masukkan nama-nama peserta rapat..."
                  rows={2} className="glass-input w-full px-5 py-3 rounded-xl text-sm text-white placeholder-white/20 resize-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-purple-300/70 text-[10px] font-bold uppercase tracking-widest mb-2">Pokok Agenda Pembahasan</label>
                <textarea value={form.agenda} onChange={e => setField('agenda', e.target.value)}
                  placeholder="Poin-poin utama yang akan dibahas..."
                  rows={2} className="glass-input w-full px-5 py-3 rounded-xl text-sm text-white placeholder-white/20 resize-none" />
              </div>
            </div>
          </div>

          {/* SECTION 2: AI VOICE & TRANSCRIPT ENGINE */}
          <div className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden">
            {/* Glow background effect */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-600/10 rounded-full filter blur-[80px]"></div>
            
            <h2 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400 tracking-widest mb-6 flex items-center gap-3 uppercase relative z-10">
              <div className="w-2 h-6 rounded-full bg-gradient-to-b from-red-400 to-pink-500" />
              Modul Rekaman & Transkripsi AI
            </h2>

            <div className="flex flex-wrap items-center gap-4 mb-6 relative z-10">
              {!recording ? (
                <button onClick={startRecording} disabled={aiLoading} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs tracking-wider transition-all bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  MULAI REKAM AUDIO
                </button>
              ) : (
                <button onClick={stopRecording} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs tracking-wider recording-pulse bg-red-500/20 border border-red-500 text-red-400">
                  <div className="w-2.5 h-2.5 rounded bg-red-500" />
                  HENTIKAN REKAMAN • {formatTime(recordingTime)}
                </button>
              )}

              <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript} className="btn-glossy flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs tracking-wider">
                {aiLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> MENGANALISIS...</>
                ) : (
                  <><span className="text-base">✨</span> STRUKTURKAN DENGAN AI</>
                )}
              </button>
            </div>

            {aiStep && (
              <div className="mb-6 px-5 py-3.5 rounded-xl text-xs font-bold tracking-widest uppercase text-fuchsia-300 bg-fuchsia-900/20 border border-fuchsia-500/30 flex items-center gap-3 relative z-10">
                <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping" />
                {aiStep}
              </div>
            )}

            <div className="relative z-10">
              <label className="block text-purple-300/70 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>Transkrip Kasar / Catatan Manual</span>
                <span className="text-purple-400/40 normal-case tracking-normal font-medium text-[10px]">Dukung Bahasa Indonesia & Banjar</span>
              </label>
              <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                placeholder="Hasil transkripsi otomatis akan muncul di sini. Anda juga bisa mengetik atau menempel (paste) catatan manual di sini sebelum merapikannya dengan AI..."
                rows={5} className="glass-input w-full px-5 py-4 rounded-xl text-[13px] text-white/90 placeholder-white/20 resize-none font-mono leading-relaxed" />
            </div>
          </div>

          {/* SECTION 3: HASIL KARYA ILMIAH NOTULEN */}
          <div className="glass-card rounded-3xl p-6 md:p-8 border-t-4 border-t-purple-500/50">
            <h2 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300 tracking-widest mb-6 flex items-center gap-3 uppercase">
              <div className="w-2 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
              Hasil Manuskrip Notulensi
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-emerald-300/70 text-[10px] font-bold uppercase tracking-widest mb-2">Penjabaran Isi Rapat</label>
                <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)}
                  placeholder="I. PEMBUKAAN... II. PEMBAHASAN..."
                  rows={15} className="glass-input w-full px-5 py-4 rounded-xl text-sm text-white/90 placeholder-white/20 resize-none leading-relaxed" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-emerald-300/70 text-[10px] font-bold uppercase tracking-widest mb-2">Kesimpulan Utama</label>
                  <textarea value={form.kesimpulan} onChange={e => setField('kesimpulan', e.target.value)}
                    placeholder="Poin-poin kesepakatan akhir..."
                    rows={5} className="glass-input w-full px-5 py-4 rounded-xl text-sm text-white/90 placeholder-white/20 resize-none leading-relaxed" />
                </div>
                <div>
                  <label className="block text-emerald-300/70 text-[10px] font-bold uppercase tracking-widest mb-2">Rencana Tindak Lanjut (RTL)</label>
                  <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)}
                    placeholder="1. Aksi - Penanggung Jawab - Tenggat Waktu..."
                    rows={5} className="glass-input w-full px-5 py-4 rounded-xl text-sm text-white/90 placeholder-white/20 resize-none leading-relaxed" />
                </div>
              </div>

              {/* Action Bar Footer */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-white/5 mt-4">
                <div className="w-full sm:w-auto flex items-center gap-3">
                  <label className="text-xs font-bold text-purple-300 uppercase tracking-widest">Status Berkas:</label>
                  <select value={form.status} onChange={e => setField('status', e.target.value)} className="glass-input px-4 py-2.5 rounded-xl text-xs font-bold outline-none cursor-pointer">
                    <option value="draft" style={{ color: '#000' }}>DRAFT SEMENTARA</option>
                    <option value="review" style={{ color: '#000' }}>PERLU DITINJAU</option>
                    <option value="final" style={{ color: '#000' }}>FINAL (SELESAI)</option>
                  </select>
                </div>
                
                <button onClick={() => handleSave()} disabled={saving} className="btn-glossy w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-extrabold tracking-widest uppercase flex items-center justify-center gap-2">
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> MENGUNGGAH KE DATABASE...</>
                  ) : (
                    <>💾 SIMPAN MANUSKRIP</>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
