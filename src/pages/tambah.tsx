import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

// =========================================================================
// IMPORT FIREBASE REALTIME DATABASE 
// (PASTIKAN PATH '../firebase' SESUAI DENGAN LOKASI FILE firebase.ts ANDA!)
// =========================================================================
import { ref, push, set, get, child, update } from 'firebase/database';
import { db } from '../firebase'; 

// =========================================================================
// BLUEPRINT TERKUNCI: FORM DATA INTERFACE
// =========================================================================
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
  // PATCH SINKRONISASI DATABASE: Sterilisasi [object Object] saat ditarik
  // =========================================================================
  const detoxDB = (val: any) => {
    if (typeof val === 'string' && val.trim() === '[object Object]') return '';
    return val;
  };

  // =========================================================================
  // BACA DATA DARI FIREBASE (JIKA MODE EDIT)
  // =========================================================================
  useEffect(() => {
    if (editId) {
      const dbRef = ref(db);
      get(child(dbRef, `notulen/${editId}`))
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
          console.error(error);
          showToast('❌ Gagal menarik data dari database.');
        });
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

      const transcribeRes = await fetch('/api/ai?action=transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' })
      });
      
      const resText = await transcribeRes.text();
      let transcript = "";
      try {
        const parsed = JSON.parse(resText);
        transcript = parsed.transcript || "";
      } catch (e) {
        throw new Error("Gagal membaca respons audio dari server.");
      }

      setField('raw_transcript', (form.raw_transcript ? form.raw_transcript + '\n\n' : '') + transcript);
      await processTranscript(transcript);
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Kesalahan Server'}`);
      setAiLoading(false);
      setAiStep('');
    }
  };

  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt.trim()) {
      showToast('⚠️ Transcript masih kosong. Isi atau rekam suara dulu!');
      return;
    }

    setAiLoading(true);
    setAiStep('🧠 Neural AI sedang menyusun notulen profesional...');

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
      
      const rawTextResponse = await res.text();
      let finalJudul = '', finalIsi = '', finalKesimpulan = '', finalTindakLanjut = '';
      let cleanStr = rawTextResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();

      try {
        const parsedData = JSON.parse(cleanStr);
        finalJudul = parsedData.judul_saran || parsedData.judul || '';
        finalIsi = parsedData.isi_notulen || parsedData.isi || '';
        finalKesimpulan = parsedData.kesimpulan || '';
        finalTindakLanjut = parsedData.tindak_lanjut || parsedData.tindaklanjut || '';
      } catch (e1) {
        const getMatch = (key: string) => {
          const regex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?:,"|}|\\n)`, 'i');
          const match = cleanStr.match(regex);
          return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
        };
        finalJudul = getMatch('judul_saran') || getMatch('judul');
        finalIsi = getMatch('isi_notulen') || getMatch('isi');
        finalKesimpulan = getMatch('kesimpulan');
        finalTindakLanjut = getMatch('tindak_lanjut') || getMatch('tindaklanjut');
        if (!finalIsi) finalIsi = cleanStr;
      }

      // =========================================================================
      // PENGHANCUR OBJEK REKURSIF BAWAAN ASLI ANDA
      // =========================================================================
      const formatText = (val: any): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return String(val).replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
        if (Array.isArray(val)) {
          return val.map(v => formatText(v)).join('\n');
        }
        if (typeof val === 'object') {
          return Object.values(val).map(v => formatText(v)).join('\n\n');
        }
        return String(val).trim();
      };

      setForm(prev => ({
        ...prev,
        judul: finalJudul ? formatText(finalJudul) : (prev.judul || 'Draft Otomatis AI'),
        isi_notulen: finalIsi ? formatText(finalIsi) : prev.isi_notulen,
        kesimpulan: finalKesimpulan ? formatText(finalKesimpulan) : prev.kesimpulan,
        tindak_lanjut: finalTindakLanjut ? formatText(finalTindakLanjut) : prev.tindak_lanjut,
      }));

      showToast('✨ Blueprint AI Sukses Diekstraksi!');
    } catch (err: any) {
      showToast(`❌ Gagal Proses AI: ${err.message}`);
    } finally {
      setAiLoading(false);
      setAiStep('');
    }
  };

  // =========================================================================
  // SIMPAN DATA KE FIREBASE
  // =========================================================================
  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) {
      showToast('⚠️ IDENTIFIKASI GAGAL: Judul dan Tanggal Wajib Diisi!');
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
        // MODE EDIT: Update node yang sudah ada di database
        const notulenRef = ref(db, `notulen/${editId}`);
        await update(notulenRef, payload);
      } else {
        // MODE BARU: Push data baru ke database
        const notulenListRef = ref(db, 'notulen');
        const newNotulenRef = push(notulenListRef);
        targetId = newNotulenRef.key as string; // Ambil ID unik yang dibuat Firebase
        
        await set(newNotulenRef, {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      showToast('✅ PROTOKOL PENYIMPANAN BERHASIL!');
      
      // Redirect ke halaman detail menggunakan ID dari Firebase
      setTimeout(() => router.push(`/notulen/${targetId}`), 1500);
      
    } catch (err: any) {
      showToast(`🚨 SISTEM ERROR: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const countWords = (text: string) => text ? text.trim().split(/\s+/).length : 0;
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{isEdit ? 'Re-Build' : 'Initialize'} Core — NotulenAI V4</title>
      </Head>

      <div className="min-h-screen bg-[#020617] overflow-x-hidden w-full text-slate-200 font-sans selection:bg-cyan-500/30">
        
        {/* TOAST NOTIFICATION MODEREN */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl text-sm font-bold animate-bounce backdrop-blur-2xl transition-all"
            style={{ background: 'rgba(2, 6, 23, 0.8)', border: '1px solid rgba(34, 211, 238, 0.5)', boxShadow: '0 10px 40px -10px rgba(34,211,238,0.5)' }}>
            <div className="flex items-center gap-3 text-cyan-300">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              {toast}
            </div>
          </div>
        )}

        {/* NAVBAR CYBERPUNK */}
        <nav className="border-b border-cyan-900/40 sticky top-0 z-40 backdrop-blur-2xl bg-[#020617]/80 w-full">
          <div className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] font-bold text-cyan-500 tracking-[0.2em] uppercase">
                  Secure Connection
                </span>
                <span className="font-bold text-lg tracking-wide text-white flex items-center gap-2">
                  {isEdit ? 'EDIT' : 'NEW'} <span className="text-cyan-400">BLUEPRINT</span>
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleSave('draft')} disabled={saving}
                className="hidden sm:block px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-slate-900/50 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                Save Draft
              </button>
              <button onClick={() => handleSave('final')} disabled={saving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                {saving ? 'Encrypting...' : 'Deploy Final'}
              </button>
            </div>
          </div>
        </nav>

        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* KOLOM KIRI */}
          <div className="lg:col-span-5 space-y-8">
            
            <div className="relative rounded-2xl p-6 md:p-8 bg-gradient-to-b from-[#0f172a] to-[#020617] border border-slate-800 shadow-2xl">
              <div className="absolute top-0 left-8 w-32 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
              <h2 className="text-sm font-bold text-white tracking-widest mb-6 flex items-center gap-3 uppercase">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
                Metadata Rapat
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Judul Dokumen *</label>
                  <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white placeholder-slate-600 outline-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Tanggal *</label>
                    <input type="date" value={form.tanggal} onChange={e => setField('tanggal', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono text-white outline-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Lokasi</label>
                    <input type="text" value={form.tempat} onChange={e => setField('tempat', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Jam Mulai</label>
                    <input type="time" value={form.waktu_mulai} onChange={e => setField('waktu_mulai', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono text-white outline-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Jam Selesai</label>
                    <input type="time" value={form.waktu_selesai} onChange={e => setField('waktu_selesai', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono text-white outline-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Pimpinan Rapat</label>
                    <input type="text" value={form.pimpinan_rapat} onChange={e => setField('pimpinan_rapat', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Notulis</label>
                    <input type="text" value={form.notulis} onChange={e => setField('notulis', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Daftar Peserta</label>
                  <textarea value={form.peserta} onChange={e => setField('peserta', e.target.value)}
                    rows={2} className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all text-justify whitespace-pre-wrap" style={{ fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-[0.15em] mb-2">Agenda Utama</label>
                  <textarea value={form.agenda} onChange={e => setField('agenda', e.target.value)}
                    rows={2} className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none bg-slate-900/50 border border-slate-800 focus:border-cyan-500 transition-all text-justify whitespace-pre-wrap" style={{ fontFamily: 'inherit' }} />
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl p-6 md:p-8 bg-gradient-to-b from-[#1e1423] to-[#020617] border border-fuchsia-900/50 shadow-2xl">
              <div className="absolute top-0 right-8 w-32 h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent"></div>
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold text-white tracking-widest flex items-center gap-3 uppercase">
                  <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
                    <span className={`w-2 h-2 rounded-full ${recording ? 'bg-red-500 animate-ping' : 'bg-fuchsia-400'}`} />
                  </div>
                  Voice Neural Link
                </h2>
                <span className="text-[10px] font-mono text-fuchsia-300 bg-fuchsia-950/50 border border-fuchsia-900 px-3 py-1 rounded-full">
                  {countWords(form.raw_transcript)} Words
                </span>
              </div>
              
              <div className="flex gap-4 mb-6">
                {!recording ? (
                  <button onClick={startRecording} disabled={aiLoading}
                    className="flex-1 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:border-fuchsia-400 disabled:opacity-30">
                    🎙️ Record Audio
                  </button>
                ) : (
                  <button onClick={stopRecording}
                    className="flex-1 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-500/20 border border-red-500 text-red-200 animate-pulse">
                    ⏹️ Stop • {formatTime(recordingTime)}
                  </button>
                )}

                <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript.trim()}
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:pointer-events-none bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] hover:scale-[1.02]">
                  {aiLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>🧠 Generate AI</>
                  )}
                </button>
              </div>

              {aiStep && (
                <div className="mb-6 px-4 py-3 rounded-xl text-xs font-mono text-fuchsia-300 bg-fuchsia-950/40 border border-fuchsia-900/50 animate-pulse flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping" />
                  {aiStep}
                </div>
              )}

              <div>
                <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                  placeholder="Injeksi data teks mentah atau hasil rekaman rapat Anda ke sini..."
                  rows={6} className="w-full px-5 py-4 rounded-xl text-sm font-mono text-slate-300 placeholder-slate-700 outline-none resize-none bg-[#0a0f1e] border border-fuchsia-900/30 focus:border-fuchsia-500/50 transition-all leading-relaxed" />
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: DASHBOARD OUTPUT */}
          <div className="lg:col-span-7 space-y-8">
            
            <div className="relative rounded-2xl p-6 md:p-8 bg-gradient-to-b from-[#0a191e] to-[#020617] border border-emerald-900/50 shadow-2xl">
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
              
              <div className="flex justify-between items-center mb-8 border-b border-emerald-900/30 pb-5">
                <h2 className="text-sm font-bold text-white tracking-widest flex items-center gap-3 uppercase">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  Realtime Output Matrix
                </h2>
                <div className="flex gap-2">
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    🟢 Sync Active
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-emerald-400/80 text-[10px] uppercase font-bold tracking-[0.15em]">Isi Pembahasan Lengkap</label>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-950/50 px-2 py-0.5 rounded">{countWords(form.isi_notulen)} W</span>
                  </div>
                  <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)}
                    rows={12} style={{ fontFamily: 'inherit' }} className="w-full px-5 py-4 rounded-xl text-sm text-slate-200 outline-none bg-slate-900/50 border border-slate-800 focus:border-emerald-500/50 transition-all leading-loose whitespace-pre-wrap text-justify shadow-inner" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-emerald-400/80 text-[10px] uppercase font-bold tracking-[0.15em]">Kesimpulan Eksekutif</label>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-950/50 px-2 py-0.5 rounded">{countWords(form.kesimpulan)} W</span>
                  </div>
                  <textarea value={form.kesimpulan} onChange={e => setField('kesimpulan', e.target.value)}
                    rows={4} style={{ fontFamily: 'inherit' }} className="w-full px-5 py-4 rounded-xl text-sm text-slate-200 outline-none bg-slate-900/50 border border-slate-800 focus:border-emerald-500/50 transition-all leading-relaxed whitespace-pre-wrap text-justify shadow-inner" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-emerald-400/80 text-[10px] uppercase font-bold tracking-[0.15em]">Tindak Lanjut & Timeline</label>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-950/50 px-2 py-0.5 rounded">{countWords(form.tindak_lanjut)} W</span>
                  </div>
                  <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)}
                    rows={4} style={{ fontFamily: 'inherit' }} className="w-full px-5 py-4 rounded-xl text-sm text-slate-200 outline-none bg-slate-900/50 border border-slate-800 focus:border-emerald-500/50 transition-all leading-relaxed whitespace-pre-wrap text-justify shadow-inner" />
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-6 mt-4 border-t border-emerald-900/30 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-widest">Document Status</span>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}
                      className="px-4 py-2 rounded-lg text-xs font-bold outline-none bg-slate-900/80 border border-slate-700 text-white focus:border-emerald-500 transition-colors appearance-none cursor-pointer">
                      <option value="draft">📝 DRAFT</option>
                      <option value="review">👁️ IN REVIEW</option>
                      <option value="final">✅ FINALIZED</option>
                    </select>
                  </div>
                  
                  <button onClick={() => handleSave()} disabled={saving}
                    className="px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest text-center transition-all bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 disabled:opacity-50">
                    {saving ? 'Syncing to Core...' : '💾 Secure Database Sync'}
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
