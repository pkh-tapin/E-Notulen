import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ref, push, set, get, child, update } from 'firebase/database';
import { db } from '../lib/firebase'; 

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

  // =========================================================================
  // SISTEM SAFE LOCK: ANTI REFRESH & ANTI KELUAR HALAMAN OTOMATIS
  // =========================================================================
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Jika form ada isinya, cegah refresh / tutup tab browser
      if (form.judul || form.isi_notulen || form.raw_transcript) {
        e.preventDefault();
        e.returnValue = 'Data belum disimpan. Yakin ingin keluar?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form]);

  const detoxDB = (val: any) => {
    if (typeof val === 'string' && val.trim() === '[object Object]') return '';
    return val;
  };

  useEffect(() => {
    if (editId) {
      const dbRef = ref(db);
      get(child(dbRef, `notes/${editId}`))
        .then((snapshot) => {
          if (snapshot.exists()) {
            const d = snapshot.val();
            setForm({
              ...d,
              isi_notulen: detoxDB(d.isi_notulen),
              kesimpulan: detoxDB(d.kesimpulan),
              tindak_lanjut: detoxDB(d.tindak_lanjut),
              agenda: detoxDB(d.agenda),
              peserta: detoxDB(d.peserta),
              raw_transcript: detoxDB(d.raw_transcript)
            });
          } else {
            showToast('⚠️ Data tidak ditemukan di database.');
          }
        })
        .catch((error) => {
          console.error("Error Fetch Edit:", error);
          showToast('❌ Gagal menarik data dari database.');
        });
    }
  }, [editId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 5500); // Waktu toast diperpanjang agar pesan error terbaca
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
      showToast('❌ Akses mikrofon ditolak atau tidak tersedia.');
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
    setAiStep('🎙️ Mengonversi gelombang suara ke teks...');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const transcribeRes = await fetch('/api/analyze?action=transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' })
      });
      
      const resData = await transcribeRes.json();
      
      if (!transcribeRes.ok) {
        throw new Error(resData.error || "Gagal memproses suara.");
      }

      setField('raw_transcript', (form.raw_transcript ? form.raw_transcript + '\n\n' : '') + resData.transcript);
      await processTranscript(resData.transcript);
    } catch (err: any) {
      showToast(`❌ Transkripsi Error: ${err.message}`);
      setAiLoading(false);
      setAiStep('');
    }
  };

  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt.trim()) {
      showToast('⚠️ Transcript masih kosong. Ketik isi atau rekam suara dulu!');
      return;
    }

    setAiLoading(true);
    setAiStep('🧠 Neural AI sedang menyusun notulen profesional...');

    try {
      const res = await fetch('/api/analyze?action=process', {
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
      
      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || "Terjadi kesalahan server saat proses AI.");
      }

      const finalData = resData.data || resData;

      const formatText = (val: any): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return String(val).replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
        if (Array.isArray(val)) return val.map(v => formatText(v)).join('\n');
        if (typeof val === 'object') return Object.values(val).map(v => formatText(v)).join('\n\n');
        return String(val).trim();
      };

      setForm(prev => ({
        ...prev,
        judul: finalData.judul || finalData.judul_saran ? formatText(finalData.judul || finalData.judul_saran) : prev.judul,
        isi_notulen: finalData.isi_notulen || finalData.poin_penting ? formatText(finalData.isi_notulen || finalData.poin_penting) : prev.isi_notulen,
        kesimpulan: finalData.kesimpulan || finalData.ringkasan ? formatText(finalData.kesimpulan || finalData.ringkasan) : prev.kesimpulan,
        tindak_lanjut: finalData.tindak_lanjut ? formatText(finalData.tindak_lanjut) : prev.tindak_lanjut,
      }));

      showToast('✨ Blueprint AI Sukses Diekstraksi!');
    } catch (err: any) {
      showToast(`❌ Gagal Proses AI: ${err.message}`);
    } finally {
      setAiLoading(false);
      setAiStep('');
    }
  };

  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) {
      showToast('⚠️ Judul dan Tanggal Wajib Diisi!');
      return;
    }

    setSaving(true);
    const finalStatus = statusOverride || form.status || 'draft';

    try {
      const payload = {
        judul: String(form.judul || '').trim(),
        tanggal: String(form.tanggal || ''),
        waktu_mulai: String(form.waktu_mulai || ''),
        waktu_selesai: String(form.waktu_selesai || ''),
        tempat: String(form.tempat || '').trim(),
        pimpinan_rapat: String(form.pimpinan_rapat || '').trim(),
        notulis: String(form.notulis || '').trim(),
        peserta: String(form.peserta || '').trim(),
        agenda: String(form.agenda || '').trim(),
        isi_notulen: String(form.isi_notulen || '').trim(),
        kesimpulan: String(form.kesimpulan || '').trim(),
        tindak_lanjut: String(form.tindak_lanjut || '').trim(),
        status: finalStatus,
        raw_transcript: String(form.raw_transcript || '').trim(),
        updatedAt: new Date().toISOString()
      };

      let targetId = editId as string;

      if (isEdit && editId) {
        const notulenRef = ref(db, `notes/${editId}`);
        await update(notulenRef, payload);
      } else {
        const notulenListRef = ref(db, 'notes');
        const newNotulenRef = push(notulenListRef);
        targetId = newNotulenRef.key as string;
        
        await set(newNotulenRef, {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      showToast('✅ Tersimpan! Sinkronisasi Database Berhasil.');
      console.log("SUKSES SINKRON FIREBASE NODE NOTES. ID:", targetId);
      
      // Menonaktifkan anti-refresh agar pengguna bisa kembali ke home tanpa ditahan
      window.onbeforeunload = null; 
      setTimeout(() => router.push(`/`), 1500);
      
    } catch (err: any) {
      console.error("FIREBASE ERROR:", err);
      showToast(`🚨 SISTEM ERROR: Cek Koneksi Database.`);
    } finally {
      setSaving(false);
    }
  };

  const countWords = (text: string) => text ? text.trim().split(/\s+/).length : 0;
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{isEdit ? 'Edit Notulen' : 'Buat Baru'} - AI NOTE TAPIN</title>
      </Head>

      <div className="min-h-screen bg-slate-50 overflow-x-hidden w-full text-slate-800 font-sans selection:bg-yellow-200">
        
        {toast && (
          <div className="fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl text-sm font-bold animate-bounce backdrop-blur-xl transition-all bg-white border border-yellow-400 shadow-xl">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-ping" />
              {toast}
            </div>
          </div>
        )}

        <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 w-full shadow-sm">
          <div className="w-full max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-yellow-600 hover:border-yellow-400 transition-all group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
                  Secure Connection
                </span>
                <span className="font-extrabold text-sm sm:text-base tracking-wide text-slate-800 uppercase flex items-center gap-1.5">
                  {isEdit ? 'EDIT' : 'NEW'} <span className="text-yellow-500">BLUEPRINT</span>
                </span>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              {/* TOMBOL DIAMANKAN: type="button" agar browser tidak refresh */}
              <button type="button" onClick={() => handleSave('draft')} disabled={saving}
                className="hidden sm:block px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300">
                Simpan Draft
              </button>
              <button type="button" onClick={() => handleSave('final')} disabled={saving}
                className="px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all bg-yellow-400 text-yellow-950 hover:bg-yellow-500 shadow-md shadow-yellow-400/30 active:scale-95">
                {saving ? 'Menyimpan...' : 'Deploy Final'}
              </button>
            </div>
          </div>
        </nav>

        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-400"></div>
              <h2 className="text-sm font-extrabold text-slate-800 tracking-widest mb-6 flex items-center gap-3 uppercase">
                <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center text-yellow-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                Metadata Rapat
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Judul Dokumen *</label>
                  <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Tanggal *</label>
                    <input type="date" value={form.tanggal} onChange={e => setField('tanggal', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Lokasi</label>
                    <input type="text" value={form.tempat} onChange={e => setField('tempat', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Jam Mulai</label>
                    <input type="time" value={form.waktu_mulai} onChange={e => setField('waktu_mulai', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Jam Selesai</label>
                    <input type="time" value={form.waktu_selesai} onChange={e => setField('waktu_selesai', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Pimpinan Rapat</label>
                    <input type="text" value={form.pimpinan_rapat} onChange={e => setField('pimpinan_rapat', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Notulis</label>
                    <input type="text" value={form.notulis} onChange={e => setField('notulis', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Daftar Peserta</label>
                  <textarea value={form.peserta} onChange={e => setField('peserta', e.target.value)}
                    rows={2} className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 outline-none resize-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all text-justify whitespace-pre-wrap" />
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Agenda Utama</label>
                  <textarea value={form.agenda} onChange={e => setField('agenda', e.target.value)}
                    rows={2} className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 outline-none resize-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all text-justify whitespace-pre-wrap" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -z-0"></div>
              
              <div className="flex justify-between items-center mb-5 relative z-10">
                <h2 className="text-sm font-extrabold text-slate-800 tracking-widest flex items-center gap-3 uppercase">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                    <span className={`w-2.5 h-2.5 rounded-full ${recording ? 'bg-red-500 animate-ping' : 'bg-orange-500'}`} />
                  </div>
                  Voice AI Link
                </h2>
                <span className="text-[10px] font-mono text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full font-bold">
                  {countWords(form.raw_transcript)} Words
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mb-5 relative z-10">
                {/* TOMBOL DIAMANKAN: type="button" */}
                {!recording ? (
                  <button type="button" onClick={startRecording} disabled={aiLoading}
                    className="flex-1 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-400 disabled:opacity-50">
                    🎙️ Rekam Audio
                  </button>
                ) : (
                  <button type="button" onClick={stopRecording}
                    className="flex-1 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-50 border-2 border-red-500 text-red-600 animate-pulse">
                    ⏹️ Stop • {formatTime(recordingTime)}
                  </button>
                )}

                {/* TOMBOL DIAMANKAN: type="button" */}
                <button type="button" onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript.trim()}
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all disabled:opacity-50 bg-slate-800 text-white hover:bg-slate-900 shadow-lg hover:shadow-xl active:scale-95">
                  {aiLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>🧠 Generate AI</>
                  )}
                </button>
              </div>

              {aiStep && (
                <div className="mb-5 px-4 py-3 rounded-xl text-xs font-mono font-bold text-orange-600 bg-orange-50 border border-orange-200 animate-pulse flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
                  {aiStep}
                </div>
              )}

              <div className="relative z-10">
                <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                  placeholder="Ketik teks mentah atau hasil rekaman rapat Anda ke sini untuk diproses AI..."
                  rows={6} className="w-full px-5 py-4 rounded-xl text-sm font-mono text-slate-600 placeholder-slate-400 outline-none resize-none bg-slate-50 border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all leading-relaxed" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-1.5 bg-yellow-400"></div>
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-5">
                <h2 className="text-sm font-extrabold text-slate-800 tracking-widest flex items-center gap-3 uppercase">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  Output Notulensi
                </h2>
                <div className="flex gap-2">
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-full uppercase tracking-widest">
                    🟢 Ready
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em]">Isi Pembahasan Lengkap</label>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">{countWords(form.isi_notulen)} W</span>
                  </div>
                  <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)}
                    rows={12} className="w-full px-5 py-4 rounded-xl text-sm text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all leading-loose whitespace-pre-wrap text-justify shadow-inner" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em]">Kesimpulan Eksekutif</label>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">{countWords(form.kesimpulan)} W</span>
                  </div>
                  <textarea value={form.kesimpulan} onChange={e => setField('kesimpulan', e.target.value)}
                    rows={4} className="w-full px-5 py-4 rounded-xl text-sm text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all leading-relaxed whitespace-pre-wrap text-justify shadow-inner" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em]">Tindak Lanjut & Timeline</label>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">{countWords(form.tindak_lanjut)} W</span>
                  </div>
                  <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)}
                    rows={4} className="w-full px-5 py-4 rounded-xl text-sm text-slate-800 outline-none bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all leading-relaxed whitespace-pre-wrap text-justify shadow-inner" />
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-6 mt-4 border-t border-slate-100 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-widest">Status Dokumen</span>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}
                      className="px-4 py-2.5 rounded-lg text-xs font-bold outline-none bg-slate-50 border border-slate-200 text-slate-700 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all appearance-none cursor-pointer">
                      <option value="draft">📝 DRAFT</option>
                      <option value="review">👁️ IN REVIEW</option>
                      <option value="final">✅ FINALIZED</option>
                    </select>
                  </div>
                  
                  {/* TOMBOL DIAMANKAN: type="button" */}
                  <button type="button" onClick={() => handleSave()} disabled={saving}
                    className="px-8 py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-widest text-center transition-all bg-yellow-400 text-yellow-950 hover:bg-yellow-500 shadow-md shadow-yellow-400/30 active:scale-95 disabled:opacity-50">
                    {saving ? 'Syncing...' : '💾 Simpan & Sinkron'}
                  </button>
                </div>

              </div>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}
