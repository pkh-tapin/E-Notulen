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
  
  const editId = Array.isArray(edit) ? edit[0] : edit;
  const isEdit = !!editId;

  const [form, setForm] = useState<FormData>({
    judul: '', tanggal: '', waktu_mulai: '', waktu_selesai: '',
    tempat: '', pimpinan_rapat: '', notulis: '', peserta: '',
    agenda: '', isi_notulen: '', kesimpulan: '', tindak_lanjut: '',
    status: 'draft', raw_transcript: ''
  });

  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (editId) {
      fetch(`/api/notulen?id=${editId}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.id) setForm(d);
        })
        .catch(console.error);
    }
  }, [editId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const setField = (key: keyof FormData, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      showToast('❌ Gagal mengakses mikrofon. Pastikan izin diberikan.');
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
    setAiStep('🎙️ Mengonversi audio ke teks (Proses Cepat)...');

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
      showToast(`❌ ${err.message}`);
      setAiLoading(false);
      setAiStep('');
    }
  };

  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt.trim()) {
      showToast('⚠️ Isi transcript terlebih dahulu');
      return;
    }

    setAiLoading(true);
    setAiStep('🤖 AI sedang menganalisis dan merapikan notulen...');

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

      // =========================================================================
      // ALGORITMA EKSTRAKSI JSON SUPER CERDAS (ANTI ERROR / ANTI BOCOR)
      // =========================================================================
      let parsedData: any = {};

      const extractJsonString = (str: string) => {
        try {
          const cleaned = str.replace(/```(json)?/gi, '').trim();
          const start = cleaned.indexOf('{');
          const end = cleaned.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            return JSON.parse(cleaned.substring(start, end + 1));
          }
        } catch (e) { return null; }
        return null;
      };

      if (typeof rawResult === 'string') {
        parsedData = extractJsonString(rawResult) || { isi_notulen: rawResult };
      } else if (typeof rawResult === 'object') {
        parsedData = rawResult;
        // DETEKSI AKAR MASALAH: Jika AI menyelundupkan JSON mentah di dalam property "isi_notulen"
        if (typeof parsedData.isi_notulen === 'string' && parsedData.isi_notulen.trim().startsWith('{')) {
          const innerParsed = extractJsonString(parsedData.isi_notulen);
          if (innerParsed) {
            parsedData = { ...parsedData, ...innerParsed };
          }
        }
      }

      // Mapping cerdas (Otomatis mengisi form berdasarkan parameter terkuat)
      const finalJudul = parsedData.judul_saran || parsedData.judul || form.judul || '';
      const finalIsi = parsedData.isi_notulen || parsedData.isi || parsedData.pembahasan || '';
      const finalKesimpulan = parsedData.kesimpulan || form.kesimpulan || '';
      const finalTindakLanjut = parsedData.tindak_lanjut || parsedData.tindaklanjut || form.tindak_lanjut || '';

      setForm(prev => ({
        ...prev,
        judul: finalJudul,
        isi_notulen: finalIsi,
        kesimpulan: finalKesimpulan,
        tindak_lanjut: finalTindakLanjut,
      }));

      showToast('✅ Analisis AI Selesai! Data berhasil dipetakan ke formulir.');
    } catch (err: any) {
      showToast(`❌ Gagal Memproses: ${err.message}`);
    } finally {
      setAiLoading(false);
      setAiStep('');
    }
  };

  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) {
      showToast('⚠️ Judul dan Tanggal rapat wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        judul: form.judul || '',
        tanggal: form.tanggal || '',
        waktu_mulai: form.waktu_mulai || '',
        waktu_selesai: form.waktu_selesai || '',
        tempat: form.tempat || '',
        pimpinan_rapat: form.pimpinan_rapat || '',
        notulis: form.notulis || '',
        peserta: form.peserta || '',
        agenda: form.agenda || '',
        isi_notulen: form.isi_notulen || '',
        kesimpulan: form.kesimpulan || '',
        tindak_lanjut: form.tindak_lanjut || '',
        status: statusOverride || form.status || 'draft',
        raw_transcript: form.raw_transcript || ''
      };

      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { ...payload, id: editId } : payload;

      const res = await fetch('/api/notulen', {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `HTTP Error ${res.status}`);
      }

      const saved = await res.json();
      showToast('✅ Dokumen berhasil dienkripsi dan disimpan!');
      setTimeout(() => router.push(`/notulen/${saved.id || editId}`), 1200);
      
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{isEdit ? 'Ubah' : 'Entri Baru'} Notulen — E-GENLAP</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('[https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap)');

          html, body {
            background: linear-gradient(135deg, #020818 0%, #040d2b 100%);
            background-attachment: fixed;
            font-family: 'Plus Jakarta Sans', sans-serif;
            color: #ffffff; margin: 0; padding: 0;
            max-width: 100vw; overflow-x: hidden;
          }

          .glass-panel {
            background: rgba(4, 13, 43, 0.65);
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          }

          .card-glossy {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
          }

          .input-glossy {
            background: rgba(0, 0, 0, 0.3) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: #ffffff !important; transition: all 0.3s ease;
          }
          
          .input-glossy:focus {
            background: rgba(255, 255, 255, 0.03) !important;
            border-color: #38bdf8 !important;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.25) !important;
            outline: none;
          }

          .input-glossy::placeholder { color: rgba(255, 255, 255, 0.3); }

          .btn-primary-glossy {
            background: linear-gradient(135deg, #0284c7, #0369a1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4);
            color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
          }
          .btn-primary-glossy:hover:not(:disabled) {
            transform: translateY(-2px); box-shadow: 0 6px 20px rgba(2, 132, 199, 0.6);
          }

          .btn-secondary-glossy {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #e0f2fe; transition: all 0.2s ease;
          }
          .btn-secondary-glossy:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2);
          }

          /* Mode HP Optimasi */
          @media (max-width: 768px) {
            .mobile-stack { display: flex; flex-direction: column; gap: 10px; }
            .mobile-hide { display: none; }
          }
        `}</style>
      </Head>

      <div className="min-h-screen w-full">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-sm font-bold shadow-[0_0_30px_rgba(56,189,248,0.3)] border border-sky-400/30 w-[90%] md:w-auto text-center"
            style={{ background: 'rgba(2, 8, 24, 0.95)', backdropFilter: 'blur(10px)', color: '#ffffff' }}>
            {toast}
          </div>
        )}

        {/* Top Navbar Glossy */}
        <nav className="glass-panel sticky top-0 z-40 border-t-0 border-l-0 border-r-0">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </Link>
              <span className="font-bold text-base md:text-lg tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-white">
                {isEdit ? 'UBAH ARSIP' : 'ENTRI BARU'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSave('draft')} disabled={saving} className="btn-secondary-glossy px-3 py-2 md:px-4 rounded-xl text-[10px] md:text-xs font-bold tracking-widest uppercase">
                {saving ? 'Proses...' : 'Draft'}
              </button>
              <button onClick={() => handleSave('final')} disabled={saving} className="btn-primary-glossy px-3 py-2 md:px-4 rounded-xl text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5 mobile-hide"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                {saving ? 'Menyimpan...' : 'Finalisasi'}
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
          {/* Section 1: Informasi Rapat */}
          <div className="card-glossy rounded-2xl p-5 md:p-7">
            <h2 className="text-sm md:text-base font-bold text-white tracking-widest mb-5 flex items-center gap-2.5">
              <span className="w-1.5 h-5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]"></span>
              ATRIBUT PELAKSANAAN
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div className="md:col-span-2">
                <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Judul Agenda Pokok *</label>
                <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)}
                  placeholder="Ketik judul rapat koordinasi/kegiatan..."
                  className="input-glossy w-full px-4 py-3 rounded-xl text-sm" />
              </div>
              
              <div>
                <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Tanggal Pelaksanaan *</label>
                <input type="date" value={form.tanggal} onChange={e => setField('tanggal', e.target.value)}
                  className="input-glossy w-full px-4 py-3 rounded-xl text-sm [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Lokasi / Titik Kumpul</label>
                <input type="text" value={form.tempat} onChange={e => setField('tempat', e.target.value)}
                  placeholder="Contoh: Sekretariat / Ruang Rapat"
                  className="input-glossy w-full px-4 py-3 rounded-xl text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Waktu Mulai</label>
                  <input type="time" value={form.waktu_mulai} onChange={e => setField('waktu_mulai', e.target.value)}
                    className="input-glossy w-full px-4 py-3 rounded-xl text-sm [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Selesai</label>
                  <input type="time" value={form.waktu_selesai} onChange={e => setField('waktu_selesai', e.target.value)}
                    className="input-glossy w-full px-4 py-3 rounded-xl text-sm [color-scheme:dark]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
                <div>
                  <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Pimpinan Giat</label>
                  <input type="text" value={form.pimpinan_rapat} onChange={e => setField('pimpinan_rapat', e.target.value)}
                    placeholder="Nama Kapokja / Pimpinan" className="input-glossy w-full px-4 py-3 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Notulis Utama</label>
                  <input type="text" value={form.notulis} onChange={e => setField('notulis', e.target.value)}
                    placeholder="Nama pencatat" className="input-glossy w-full px-4 py-3 rounded-xl text-sm" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Daftar Hadir / Peserta</label>
                <textarea value={form.peserta} onChange={e => setField('peserta', e.target.value)}
                  placeholder="Ketik daftar peserta..." rows={2}
                  className="input-glossy w-full px-4 py-3 rounded-xl text-sm resize-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Rencana Agenda</label>
                <textarea value={form.agenda} onChange={e => setField('agenda', e.target.value)}
                  placeholder="Pokok bahasan yang akan didiskusikan..." rows={2}
                  className="input-glossy w-full px-4 py-3 rounded-xl text-sm resize-none" />
              </div>
            </div>
          </div>

          {/* Section 2: AI & Recording Interface */}
          <div className="card-glossy rounded-2xl p-5 md:p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full filter blur-[60px]"></div>
            
            <h2 className="text-sm md:text-base font-bold text-white tracking-widest mb-5 flex items-center gap-2.5">
              <span className="w-1.5 h-5 rounded-full bg-fuchsia-400 shadow-[0_0_10px_#e879f9]"></span>
              MODUL KECERDASAN BUATAN
            </h2>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
              {!recording ? (
                <button onClick={startRecording} disabled={aiLoading} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-3.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" />
                  Rekam Suara
                </button>
              ) : (
                <button onClick={stopRecording} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-3.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all bg-red-500/20 text-white border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-sm bg-white" />
                  Hentikan • {formatTime(recordingTime)}
                </button>
              )}

              <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all bg-sky-500/10 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 disabled:opacity-50">
                {aiLoading ? (
                  <><div className="w-4 h-4 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" /> Menganalisis...</>
                ) : (
                  <>✨ Format Otomatis AI</>
                )}
              </button>
            </div>

            {aiStep && (
              <div className="mb-5 px-4 py-3 rounded-xl text-xs text-sky-200 font-mono bg-sky-500/10 border border-sky-500/20 flex items-center gap-3">
                <div className="w-2 h-2 bg-sky-400 rounded-full animate-ping"></div>
                {aiStep}
              </div>
            )}

            <div>
              <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>Catatan Mentah / Transkrip</span>
                <span className="text-[9px] text-sky-400/50 normal-case tracking-normal hidden md:inline">Mendukung format paragraf acak</span>
              </label>
              <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                placeholder="Ketik catatan acak di sini atau gunakan fitur rekam suara..." rows={5}
                className="input-glossy w-full px-4 py-4 rounded-xl text-xs resize-none font-mono leading-relaxed"
                style={{ fontFamily: "'JetBrains Mono', monospace" }} />
            </div>
          </div>

          {/* Section 3: Hasil Manuskrip */}
          <div className="card-glossy rounded-2xl p-5 md:p-7">
            <h2 className="text-sm md:text-base font-bold text-white tracking-widest mb-5 flex items-center gap-2.5">
              <span className="w-1.5 h-5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"></span>
              HASIL MANUSKRIP
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Teks Laporan Lengkap</label>
                <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)}
                  placeholder="Isi detail laporan secara struktural..." rows={12}
                  className="input-glossy w-full px-5 py-4 rounded-xl text-sm resize-y leading-relaxed" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Konklusi / Kesimpulan</label>
                  <textarea value={form.kesimpulan} onChange={e => setField('kesimpulan', e.target.value)}
                    placeholder="Ringkasan keputusan rapat..." rows={4}
                    className="input-glossy w-full px-4 py-3 rounded-xl text-sm resize-none" />
                </div>
                <div>
                  <label className="block text-sky-200/70 text-[10px] font-bold uppercase tracking-widest mb-2">Target Tindak Lanjut</label>
                  <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)}
                    placeholder="Langkah nyata berikutnya..." rows={4}
                    className="input-glossy w-full px-4 py-3 rounded-xl text-sm resize-none font-mono" />
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full md:w-auto">
                  <label className="block text-sky-200/70 text-[9px] font-bold uppercase tracking-widest mb-1.5">Status Dokumen</label>
                  <select value={form.status} onChange={e => setField('status', e.target.value)}
                    className="input-glossy w-full md:w-48 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider appearance-none">
                    <option value="draft" style={{ color: '#000' }}>📄 Berkas Draft</option>
                    <option value="review" style={{ color: '#000' }}>👁️ Perlu Review</option>
                    <option value="final" style={{ color: '#000' }}>✅ Final (Selesai)</option>
                  </select>
                </div>
                
                <button onClick={() => handleSave()} disabled={saving} className="btn-primary-glossy w-full md:w-auto px-8 py-3.5 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  {saving ? 'Sinkronisasi...' : 'SIMPAN KE DATABASE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
