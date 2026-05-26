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
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (editId) {
      fetch(`/api/notulen?id=${editId}`)
        .then(r => r.json())
        .then(d => {
          if (d && !d.error) setForm(d);
        })
        .catch(err => showToast('❌ Gagal memuat data dari database', 'error'));
    }
  }, [editId]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000); 
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
      showToast('❌ Gagal mengakses mikrofon. Pastikan izin diberikan.', 'error');
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
    setAiStep('🎙️ Mengonversi suara ke teks...');

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
      
      if (!transcribeRes.ok) throw new Error('Gagal transkrip audio ke teks');
      
      const { transcript } = await transcribeRes.json();
      setField('raw_transcript', (form.raw_transcript ? form.raw_transcript + '\n\n' : '') + transcript);
      await processTranscript(transcript);
    } catch (err: any) {
      showToast(`❌ ${err.message}`, 'error');
      setAiLoading(false);
      setAiStep('');
    }
  };

  // =========================================================================
  // PERBAIKAN MESIN AI: Penanganan Error 500 Ekstrem Lapis Baja
  // =========================================================================
  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt.trim()) {
      showToast('⚠️ Isi transcript terlebih dahulu sebelum diproses AI', 'info');
      return;
    }

    setAiLoading(true);
    setAiStep('🤖 AI sedang merapikan dan menyusun notulen...');

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
      
      // ANTI-CRASH: Tangkap error dari backend dengan aman
      let rawResult;
      try {
        rawResult = await res.json();
      } catch (parseErr) {
        throw new Error('Server mengembalikan format yang tidak dikenali.');
      }

      if (!res.ok) {
        throw new Error(rawResult.error || `Server Error ${res.status}: Gagal memproses AI`);
      }
      
      let finalJudul = '';
      let finalIsi = '';
      let finalKesimpulan = '';
      let finalTindakLanjut = '';

      // Ekstraktor Ekstrim
      let cleanStr = '';
      if (typeof rawResult === 'string') {
        cleanStr = rawResult.replace(/```json/gi, '').replace(/```/gi, '').trim();
      } else if (typeof rawResult === 'object') {
        cleanStr = JSON.stringify(rawResult);
      }

      try {
        const parsedData = JSON.parse(cleanStr);
        finalJudul = parsedData.judul_saran || parsedData.judul || '';
        finalIsi = parsedData.isi_notulen || parsedData.isi || '';
        finalKesimpulan = parsedData.kesimpulan || '';
        finalTindakLanjut = parsedData.tindak_lanjut || parsedData.tindaklanjut || '';
      } catch (e1) {
        console.warn("Menerapkan ekstraksi regex karena JSON tidak murni...");
        const getMatch = (key: string) => {
          const regex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?:,"|})`, 'i');
          const match = cleanStr.match(regex);
          return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
        };

        finalJudul = getMatch('judul_saran') || getMatch('judul');
        finalIsi = getMatch('isi_notulen') || getMatch('isi');
        finalKesimpulan = getMatch('kesimpulan');
        finalTindakLanjut = getMatch('tindak_lanjut') || getMatch('tindaklanjut');
        
        if (!finalIsi) finalIsi = cleanStr; // Fallback jika gagal total
      }

      const formatText = (text: string) => text ? String(text).replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';

      setForm(prev => ({
        ...prev,
        judul: finalJudul ? formatText(finalJudul) : prev.judul,
        isi_notulen: finalIsi ? formatText(finalIsi) : prev.isi_notulen,
        kesimpulan: finalKesimpulan ? formatText(finalKesimpulan) : prev.kesimpulan,
        tindak_lanjut: finalTindakLanjut ? formatText(finalTindakLanjut) : prev.tindak_lanjut,
      }));

      showToast('✅ Berhasil! Notulen tersusun otomatis oleh AI!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`❌ ${err.message}. Coba tekan "Proses AI" sekali lagi.`, 'error');
    } finally {
      setAiLoading(false);
      setAiStep('');
    }
  };

  const triggerDownload = (notulenData: FormData) => {
    showToast('⬇️ Data berstatus Final. PDF siap dicetak di halaman Detail.', 'info');
  };

  // =========================================================================
  // SIMPAN CEPAT TANPA LOADING LAMBAT (Optimistic Update pattern)
  // =========================================================================
  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) {
      showToast('⚠️ Judul dan Tanggal Rapat wajib diisi!', 'error');
      return;
    }

    setSaving(true);
    const finalStatus = statusOverride || form.status || 'draft';

    try {
      const payload = {
        judul: String(form.judul || ''),
        tanggal: String(form.tanggal || ''),
        waktu_mulai: String(form.waktu_mulai || ''),
        waktu_selesai: String(form.waktu_selesai || ''),
        tempat: String(form.tempat || ''),
        pimpinan_rapat: String(form.pimpinan_rapat || ''),
        notulis: String(form.notulis || ''),
        peserta: String(form.peserta || ''),
        agenda: String(form.agenda || ''),
        isi_notulen: String(form.isi_notulen || ''),
        kesimpulan: String(form.kesimpulan || ''),
        tindak_lanjut: String(form.tindak_lanjut || ''),
        status: finalStatus,
        raw_transcript: String(form.raw_transcript || '')
      };

      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { ...payload, id: editId } : payload;

      const res = await fetch('/api/notulen', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Gagal menyimpan ke database (Error ${res.status})`);
      }

      const saved = await res.json();
      showToast('✅ Tersimpan ke Database dengan Cepat & Aman!', 'success');

      if (finalStatus === 'final') {
        triggerDownload(payload);
      }
      
      // Navigasi langsung ke detail untuk kesan "tanpa loading lama"
      router.push(`/notulen/${saved.id || editId}`);
      
    } catch (err: any) {
      console.error("SIMPAN ERROR:", err);
      showToast(`❌ ${err.message}`, 'error');
      setSaving(false); // Kembalikan tombol jika gagal
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{isEdit ? 'Edit' : 'Tambah'} Notulen AI — E-Laporan Tapin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="min-h-screen bg-[#020617] overflow-x-hidden w-full text-slate-200 selection:bg-cyan-500/30">
        
        {/* TOAST NOTIFICATION CANGGIH */}
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl text-sm font-semibold shadow-2xl transition-all duration-300 animate-slide-up flex items-center gap-3 backdrop-blur-xl border
            ${toast.type === 'error' ? 'bg-red-950/80 border-red-500/50 text-red-200' : 
              toast.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' : 
              'bg-[#061240]/90 border-cyan-500/40 text-cyan-100'}
          `}>
            {toast.type === 'error' && <span className="text-xl">⚠️</span>}
            {toast.type === 'success' && <span className="text-xl">✅</span>}
            {toast.type === 'info' && <span className="text-xl">ℹ️</span>}
            {toast.msg}
          </div>
        )}

        {/* NAVBAR STICKY SUPER PREMIUM */}
        <nav className="border-b border-cyan-900/40 sticky top-0 z-40 backdrop-blur-2xl bg-[#020617]/80 w-full shadow-[0_4px_30px_rgba(6,18,64,0.5)]">
          <div className="w-full max-w-6xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/50 transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="font-display text-xl md:text-2xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                  {isEdit ? 'EDIT NOTULEN' : 'NOTULEN BARU'}
                </h1>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                  Sistem AI Aktif
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => handleSave('draft')} disabled={saving}
                className="hidden md:flex px-5 py-2.5 rounded-lg text-sm font-semibold transition-all bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-cyan-500/50 items-center gap-2">
                💾 Simpan Draft
              </button>
              <button onClick={() => handleSave('final')} disabled={saving}
                className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all bg-gradient-to-r from-cyan-600 to-blue-600 border border-cyan-400/50 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] hover:scale-[1.02] items-center flex gap-2 disabled:opacity-50">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Proses...</>
                ) : '✓ Finalisasi & Simpan'}
              </button>
            </div>
          </div>
        </nav>

        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
          
          {/* PANEL 1: INFORMASI UTAMA & TANGGAL */}
          <div className="rounded-2xl p-6 md:p-8 backdrop-blur-xl bg-slate-900/40 border border-slate-800 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-blue-600"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">📋</div>
                Informasi Utama Rapat
              </h2>
              {form.tanggal && (
                <div className="px-4 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs font-mono font-bold tracking-widest">
                  TGL: {form.tanggal}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Kolom Judul Lebar */}
              <div className="md:col-span-12">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Judul Rapat *</label>
                <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)}
                  placeholder="Ketik judul rapat di sini..."
                  className="w-full px-5 py-4 rounded-xl text-lg font-medium text-white placeholder-slate-600 outline-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all" />
              </div>

              {/* Baris Tanggal & Waktu */}
              <div className="md:col-span-4">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Tanggal *</label>
                <input type="date" value={form.tanggal} onChange={e => setField('tanggal', e.target.value)}
                  className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 outline-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>
              <div className="md:col-span-4">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Mulai</label>
                <input type="time" value={form.waktu_mulai} onChange={e => setField('waktu_mulai', e.target.value)}
                  className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 outline-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>
              <div className="md:col-span-4">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Selesai</label>
                <input type="time" value={form.waktu_selesai} onChange={e => setField('waktu_selesai', e.target.value)}
                  className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 outline-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>

              {/* Baris Detail Pelaksana */}
              <div className="md:col-span-4">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Lokasi / Tempat</label>
                <input type="text" value={form.tempat} onChange={e => setField('tempat', e.target.value)} placeholder="Misal: Aula Utama"
                  className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>
              <div className="md:col-span-4">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Pimpinan Rapat</label>
                <input type="text" value={form.pimpinan_rapat} onChange={e => setField('pimpinan_rapat', e.target.value)} placeholder="Nama Pimpinan"
                  className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>
              <div className="md:col-span-4">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Notulis</label>
                <input type="text" value={form.notulis} onChange={e => setField('notulis', e.target.value)} placeholder="Nama Notulis"
                  className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>

              {/* Teks Area Lebar */}
              <div className="md:col-span-6">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Daftar Peserta</label>
                <textarea value={form.peserta} onChange={e => setField('peserta', e.target.value)}
                  placeholder="Ketik nama-nama peserta rapat..."
                  rows={3} className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none resize-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>
              <div className="md:col-span-6">
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Agenda Utama</label>
                <textarea value={form.agenda} onChange={e => setField('agenda', e.target.value)}
                  placeholder="Topik yang akan dibahas..."
                  rows={3} className="w-full px-5 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none resize-none bg-slate-950/50 border border-slate-700/50 focus:border-cyan-500 transition-all" />
              </div>
            </div>
          </div>

          {/* PANEL 2: MESIN AI & REKAMAN (FUTURISTIK) */}
          <div className="rounded-2xl p-6 md:p-8 backdrop-blur-xl bg-slate-900/40 border border-indigo-900/50 shadow-[0_0_30px_rgba(79,70,229,0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            
            <h2 className="text-lg md:text-xl font-bold text-indigo-300 mb-6 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">🎙️</div>
              Ruang Ekstraksi & Mesin AI
            </h2>
            
            <div className="flex flex-col md:flex-row gap-6">
              {/* Tombol Aksi AI */}
              <div className="flex flex-col gap-4 w-full md:w-1/3">
                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800">
                  <p className="text-xs text-slate-400 mb-4 font-medium leading-relaxed">Gunakan mic untuk merekam langsung, atau paste catatan mentah Anda di kolom sebelah kanan, lalu klik Proses AI.</p>
                  
                  {!recording ? (
                    <button onClick={startRecording} disabled={aiLoading}
                      className="w-full flex justify-center items-center gap-3 px-5 py-4 rounded-xl font-bold transition-all bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 mb-3">
                      <div className="w-4 h-4 rounded-full bg-rose-500 animate-pulse" />
                      Mulai Rekam Audio
                    </button>
                  ) : (
                    <button onClick={stopRecording}
                      className="w-full flex justify-center items-center gap-3 px-5 py-4 rounded-xl font-bold transition-all bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.5)] mb-3">
                      <div className="w-4 h-4 rounded bg-white" />
                      Stop Rekaman ({formatTime(recordingTime)})
                    </button>
                  )}

                  <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript}
                    className="w-full flex justify-center items-center gap-3 px-5 py-4 rounded-xl font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] hover:scale-[1.02]">
                    {aiLoading ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Merapikan AI...</>
                    ) : (
                      <>✨ Generate AI Cerdas</>
                    )}
                  </button>
                </div>
              </div>

              {/* Area Teks Transkrip */}
              <div className="w-full md:w-2/3 relative group">
                <div className="absolute inset-0 bg-indigo-500/5 rounded-xl pointer-events-none group-hover:bg-indigo-500/10 transition-all"></div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 pl-2">
                  Transkrip Mentah / Input Manual
                </label>
                <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                  placeholder="Ketikan catatan kasar di sini, atau hasil rekaman suara otomatis akan masuk ke kotak ini..."
                  className="w-full h-[220px] px-5 py-4 rounded-xl text-sm text-indigo-100 placeholder-indigo-900/50 outline-none resize-none font-mono bg-slate-950/80 border border-indigo-900/50 focus:border-indigo-500/50 transition-all scrollbar-thin scrollbar-thumb-indigo-900 scrollbar-track-transparent leading-relaxed" />
                
                {/* Indikator Status AI yang Melayang */}
                {aiStep && (
                  <div className="absolute bottom-4 right-4 px-4 py-2 rounded-lg text-xs font-bold text-indigo-200 bg-indigo-600/80 backdrop-blur border border-indigo-400 shadow-xl animate-pulse flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                    {aiStep}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PANEL 3: HASIL NOTULEN (BERSIH & PROFESIONAL) */}
          <div className="rounded-2xl p-6 md:p-8 backdrop-blur-xl bg-slate-900/40 border border-emerald-900/30 shadow-[0_0_30px_rgba(16,185,129,0.03)] relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-teal-600"></div>
            
            <h2 className="text-lg md:text-xl font-bold text-emerald-400 mb-6 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">📝</div>
              Hasil Notulen Tersusun
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 flex justify-between">
                  <span>Isi Notulen Lengkap</span>
                  <span className="text-emerald-500 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded">Editable</span>
                </label>
                <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)}
                  rows={10} className="w-full px-6 py-5 rounded-xl text-base text-slate-100 outline-none resize-y bg-slate-950/60 border border-emerald-900/50 focus:border-emerald-500/50 transition-all leading-relaxed whitespace-pre-wrap shadow-inner" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Kesimpulan / Keputusan</label>
                  <textarea value={form.kesimpulan} onChange={e => setField('kesimpulan', e.target.value)}
                    rows={4} className="w-full px-5 py-4 rounded-xl text-sm text-slate-200 outline-none resize-none bg-slate-950/60 border border-emerald-900/50 focus:border-emerald-500/50 transition-all whitespace-pre-wrap" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Tindak Lanjut</label>
                  <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)}
                    rows={4} className="w-full px-5 py-4 rounded-xl text-sm text-slate-200 outline-none resize-none bg-slate-950/60 border border-emerald-900/50 focus:border-emerald-500/50 transition-all whitespace-pre-wrap" />
                </div>
              </div>

              {/* Status & Simpan Bawah */}
              <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-800 gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Status Dokumen:</span>
                  <select value={form.status} onChange={e => setField('status', e.target.value)}
                    className="px-4 py-2.5 rounded-lg text-sm font-bold outline-none bg-slate-950 border border-slate-700 focus:border-cyan-500 text-cyan-300 shadow-inner appearance-none cursor-pointer">
                    <option value="draft">📝 DRAFT</option>
                    <option value="review">👁️ PERLU REVIEW</option>
                    <option value="final">✅ FINAL & CETAK</option>
                  </select>
                </div>
                
                <button onClick={() => handleSave()} disabled={saving}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold transition-all bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-[1.02] flex items-center justify-center gap-2">
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Merekam ke Database...</>
                  ) : '💾 Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
