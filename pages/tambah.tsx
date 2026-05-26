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
          if (d && !d.error) setForm(d);
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
    setAiStep('🎙️ Mengonversi audio ke teks...');

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
      
      // 🛡️ BENTENG PRE-CHECK AUDIO
      const resText = await transcribeRes.text();
      let transcript = "";
      try {
        const parsed = JSON.parse(resText);
        transcript = parsed.transcript || "";
      } catch (e) {
        throw new Error("Gagal mengenali struktur audio. Pastikan suara terdengar jelas.");
      }

      setField('raw_transcript', (form.raw_transcript ? form.raw_transcript + '\n\n' : '') + transcript);
      await processTranscript(transcript);
    } catch (err: any) {
      showToast(`❌ ${err.message}`);
      setAiLoading(false);
      setAiStep('');
    }
  };

  // =========================================================================
  // PERBAIKAN MESIN AI LAPIS BAJA (ANTI-CRASH 'Unexpected Token E')
  // =========================================================================
  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt.trim()) {
      showToast('⚠️ Isi transcript terlebih dahulu');
      return;
    }

    setAiLoading(true);
    setAiStep('🧠 AI sedang merapikan dan memetakan data ke kolom kanan...');

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
      
      // 🛡️ REVOLUSI UTAMA: Ambil data sebagai TEXT murni terlebih dahulu!
      // Menghindari crash fatal jika AI membalas text biasa/error string (Token E)
      const rawTextResponse = await res.text();
      
      let finalJudul = '';
      let finalIsi = '';
      let finalKesimpulan = '';
      let finalTindakLanjut = '';

      // Bersihkan bungkusan markdown ```json jika ada
      let cleanStr = rawTextResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();

      try {
        // Percobaan Jalur 1: Mengurai JSON Standar
        const parsedData = JSON.parse(cleanStr);
        finalJudul = parsedData.judul_saran || parsedData.judul || '';
        finalIsi = parsedData.isi_notulen || parsedData.isi || '';
        finalKesimpulan = parsedData.kesimpulan || '';
        finalTindakLanjut = parsedData.tindak_lanjut || parsedData.tindaklanjut || '';
      } catch (e1) {
        console.warn("🤖 Deteksi JSON kotor/Teks Mentah, Mengaktifkan Ekstraktor Regex Paksa...");
        
        // Percobaan Jalur 2: Pencabutan Paksa dengan Kunci Karakter (Regex Machine)
        const getMatch = (key: string) => {
          const regex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?:,"|}|\\n)`, 'i');
          const match = cleanStr.match(regex);
          return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
        };

        finalJudul = getMatch('judul_saran') || getMatch('judul');
        finalIsi = getMatch('isi_notulen') || getMatch('isi');
        finalKesimpulan = getMatch('kesimpulan');
        finalTindakLanjut = getMatch('tindak_lanjut') || getMatch('tindaklanjut');
        
        // Jalur Darurat Akhir: Jika hancur total, inject seluruh text ke dalam lembar isi
        if (!finalIsi) {
          finalIsi = cleanStr;
        }
      }

      const formatText = (text: string) => {
        if (!text) return '';
        return String(text).replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
      };

      // 🎯 MAPPING PURNA JUAL KE STATE KOLOM KANAN
      setForm(prev => ({
        ...prev,
        judul: finalJudul ? formatText(finalJudul) : (prev.judul || 'Notulen Otomatis AI'),
        isi_notulen: finalIsi ? formatText(finalIsi) : prev.isi_notulen,
        kesimpulan: finalKesimpulan ? formatText(finalKesimpulan) : prev.kesimpulan,
        tindak_lanjut: finalTindakLanjut ? formatText(finalTindakLanjut) : prev.tindak_lanjut,
      }));

      showToast('✨ Sukses! AI Berhasil memetakan data ke kolom kanan.');
    } catch (err: any) {
      console.error("AI Error:", err);
      showToast(`❌ Gagal Memproses AI: ${err.message}`);
    } finally {
      setAiLoading(false);
      setAiStep('');
    }
  };

  const triggerDownload = (notulenData: FormData) => {
    showToast('⬇️ Data tersimpan. Silakan klik Cetak PDF di halaman Detail.');
  };

  // =========================================================================
  // PERBAIKAN TOTAL SIMPAN DATA DATABASE
  // =========================================================================
  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) {
      showToast('⚠️ Judul dan tanggal wajib diisi');
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
        raw_transcript: String(form.raw_transcript || '').trim()
      };

      const method = isEdit ? 'PUT' : 'POST';
      const bodyPayload = isEdit ? { ...payload, id: editId } : payload;

      const res = await fetch('/api/notulen', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        body: JSON.stringify(bodyPayload)
      });

      // Protektor respons text sebelum di-json-kan agar tidak crash
      const resText = await res.text();
      let savedData;
      try {
        savedData = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Gagal membaca respons database. Detail: ${resText.substring(0, 50)}`);
      }

      if (!res.ok) {
        throw new Error(savedData.details || savedData.error || `HTTP Error ${res.status}`);
      }

      showToast('✅ DATA BERHASIL DISIMPAN KE DATABASE!');

      if (finalStatus === 'final') {
        triggerDownload(payload);
      }
      
      // Amankan ID pengalihan halaman agar tidak terlempar ke 'undefined'
      const targetId = savedData.id || editId || Date.now().toString();
      setTimeout(() => router.push(`/notulen/${targetId}`), 1500);
      
    } catch (err: any) {
      console.error("❌ DEBUG SIMPAN DATABASE:", err);
      showToast(`🚨 Gagal Sinkronisasi Database: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Fitur Canggih Pendunia: Penghitung Kata Dinamis
  const countWords = (text: string) => {
    if (!text || text.trim() === '') return 0;
    return text.trim().split(/\s+/).length;
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{isEdit ? 'Edit' : 'Tambah'} Notulen — NotulenAI Professional</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="min-h-screen bg-[#020818] overflow-x-hidden w-full text-slate-200 antialiased font-sans">
        
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-6 py-3.5 rounded-xl text-sm font-semibold animate-slide-up backdrop-blur-xl transition-all"
            style={{ background: 'rgba(4, 15, 43, 0.95)', border: '2px solid rgba(34, 211, 238, 0.6)', boxShadow: '0 0 30px rgba(34, 211, 238, 0.3)' }}>
            <div className="flex items-center gap-2 text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              {toast}
            </div>
          </div>
        )}

        <nav className="border-b border-cyan-500/10 sticky top-0 z-40 backdrop-blur-xl bg-[#030d26]/80 w-full shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="w-full max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <span className="font-mono text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded tracking-widest uppercase">
                V3.5 ENGINE
              </span>
              <span className="font-bold text-sm md:text-base tracking-wider text-cyan-300 truncate">
                {isEdit ? 'EDITING' : 'CREATING'} <span className="text-white">NOTULEN SYSTEM</span>
              </span>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => handleSave('draft')} disabled={saving}
                className="hidden sm:block px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                {saving ? 'Saving...' : 'Draft'}
              </button>
              <button onClick={() => handleSave('final')} disabled={saving}
                className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:from-cyan-500/40 hover:to-blue-500/40 hover:text-white">
                {saving ? 'Processing...' : '✓ Finalize'}
              </button>
            </div>
          </div>
        </nav>

        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* KOLOM KIRI: METADATA & REKAMAN */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="rounded-xl p-5 md:p-6 backdrop-blur-md bg-[#040f2b]/70 border border-cyan-500/10 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-sm font-bold text-cyan-300 tracking-widest mb-5 flex items-center gap-2 uppercase">
                <span className="w-1.5 h-4 rounded bg-cyan-400 inline-block animate-pulse" />
                1. Metadata Rapat
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Judul Rapat *</label>
                  <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)}
                    placeholder="Contoh: Rapat Kerja PKH Kalimantan Selatan"
                    className="w-full px-4 py-2.5 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 outline-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(34,211,238,0.1)] transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Tanggal Rapat *</label>
                    <input type="date" value={form.tanggal} onChange={e => setField('tanggal', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-xs font-mono text-slate-200 outline-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Lokasi Tempat</label>
                    <input type="text" value={form.tempat} onChange={e => setField('tempat', e.target.value)}
                      placeholder="Nama Aula/Ruangan"
                      className="w-full px-3 py-2.5 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Waktu Mulai</label>
                    <input type="time" value={form.waktu_mulai} onChange={e => setField('waktu_mulai', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-xs font-mono text-slate-200 outline-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Waktu Selesai</label>
                    <input type="time" value={form.waktu_selesai} onChange={e => setField('waktu_selesai', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-xs font-mono text-slate-200 outline-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Pimpinan Rapat</label>
                    <input type="text" value={form.pimpinan_rapat} onChange={e => setField('pimpinan_rapat', e.target.value)}
                      placeholder="Nama Pimpinan"
                      className="w-full px-3 py-2.5 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Notulis</label>
                    <input type="text" value={form.notulis} onChange={e => setField('notulis', e.target.value)}
                      placeholder="Nama Pencatat"
                      className="w-full px-3 py-2.5 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Peserta Rapat</label>
                  <textarea value={form.peserta} onChange={e => setField('peserta', e.target.value)}
                    placeholder="Contoh: Koordinator Wilayah, SDM PKH Tapin, KPM..."
                    rows={2} className="w-full px-4 py-2 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none resize-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1.5">Agenda Utama Rapat</label>
                  <textarea value={form.agenda} onChange={e => setField('agenda', e.target.value)}
                    placeholder="Topik pembahasan utama rapat..."
                    rows={2} className="w-full px-4 py-2 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none resize-none bg-[#071333] border border-cyan-500/10 focus:border-cyan-400 transition-all" />
                </div>
              </div>
            </div>

            <div className="rounded-xl p-5 md:p-6 backdrop-blur-md bg-[#040f2b]/70 border border-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.02)]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-red-400 tracking-widest flex items-center gap-2 uppercase">
                  <span className="w-1.5 h-4 rounded bg-red-500 inline-block animate-ping" />
                  2. Voice Core Decoder
                </h2>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                  {countWords(form.raw_transcript)} Kata
                </span>
              </div>
              
              <div className="flex gap-3 mb-4">
                {!recording ? (
                  <button onClick={startRecording} disabled={aiLoading}
                    className="flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-95 disabled:opacity-30">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    Record Audio
                  </button>
                ) : (
                  <button onClick={stopRecording}
                    className="flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-500/20 border border-red-500 text-red-200 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <span className="w-2.5 h-2.5 rounded bg-red-400" />
                    Stop • {formatTime(recordingTime)}
                  </button>
                )}

                <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript.trim()}
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:pointer-events-none bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:border-cyan-400">
                  {aiLoading ? (
                    <div className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  ) : (
                    <>🚀 Generate AI</>
                  )}
                </button>
              </div>

              {aiStep && (
                <div className="mb-4 px-4 py-3 rounded-lg text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 animate-pulse flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  {aiStep}
                </div>
              )}

              <div>
                <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                  placeholder="Hasil transkripsi audio rapat atau ketikan mentah Anda akan otomatis masuk di sini..."
                  rows={6} className="w-full px-4 py-3 rounded-lg text-xs font-mono text-slate-300 placeholder-slate-700 outline-none resize-none bg-[#06112e] border border-cyan-500/10 focus:border-cyan-400 transition-all leading-relaxed" />
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: OUTPUT HASIL NOTULEN AI */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="rounded-xl p-5 md:p-6 backdrop-blur-md bg-[#040f2b]/70 border border-green-500/10 shadow-[0_0_25px_rgba(34,197,94,0.01)]">
              <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-green-400 tracking-widest flex items-center gap-2 uppercase">
                  <span className="w-1.5 h-4 rounded bg-green-400 inline-block" />
                  3. Realtime Notulen Dashboard
                </h2>
                <div className="flex gap-2">
                  <span className="text-[9px] font-mono font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded uppercase">
                    Live Analyzer
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest">Isi Notulen Lengkap</label>
                    <span className="text-[10px] font-mono text-slate-500">{countWords(form.isi_notulen)} Kata</span>
                  </div>
                  <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)}
                    placeholder="Peta isi pembahasan rapat secara detail..."
                    rows={10} className="w-full px-4 py-3 rounded-lg text-xs text-slate-200 placeholder-slate-700 outline-none bg-[#071333] border border-cyan-500/10 focus:border-green-500/40 transition-all leading-relaxed whitespace-pre-wrap" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest">Kesimpulan Inti</label>
                    <span className="text-[10px] font-mono text-slate-500">{countWords(form.kesimpulan)} Kata</span>
                  </div>
                  <textarea value={form.kesimpulan} onChange={e => setField('kes自由n', e.target.value)}
                    placeholder="Poin penting atau benang merah keputusan rapat..."
                    rows={4} className="w-full px-4 py-3 rounded-lg text-xs text-slate-200 placeholder-slate-700 outline-none bg-[#071333] border border-cyan-500/10 focus:border-green-500/40 transition-all leading-relaxed whitespace-pre-wrap" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest">Tindak Lanjut & Aksi Nyata</label>
                    <span className="text-[10px] font-mono text-slate-500">{countWords(form.tindak_lanjut)} Kata</span>
                  </div>
                  <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)}
                    placeholder="Rencana aksi, penanggung jawab, dan tenggat waktu kerja..."
                    rows={4} className="w-full px-4 py-3 rounded-lg text-xs font-mono text-cyan-300 placeholder-slate-700 outline-none bg-[#071333] border border-cyan-500/10 focus:border-green-500/40 transition-all leading-relaxed whitespace-pre-wrap" />
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-4 border-t border-slate-800 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 font-mono uppercase">Status:</span>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold outline-none bg-[#071333] border border-cyan-500/20 text-slate-200 focus:border-cyan-400 transition-colors">
                      <option value="draft">📝 DRAFT ENGINE</option>
                      <option value="review">👁️ REVIEW CORE</option>
                      <option value="final">✅ FINAL PRODUCTION</option>
                    </select>
                  </div>
                  
                  <button onClick={() => handleSave()} disabled={saving}
                    className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-center transition-all bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:from-emerald-500/30 hover:to-teal-500/30 hover:text-white active:scale-95 disabled:opacity-40">
                    {saving ? 'Synchronizing...' : '💾 Sync to Database'}
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
