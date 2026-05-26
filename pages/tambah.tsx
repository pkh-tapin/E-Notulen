import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface FormData {
  judul: string; tanggal: string; waktu_mulai: string; waktu_selesai: string;
  tempat: string; pimpinan_rapat: string; notulis: string; peserta: string;
  agenda: string; isi_notulen: string; kesimpulan: string; tindak_lanjut: string;
  status: string; raw_transcript: string;
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
      fetch(`/api/notulen?id=${editId}`).then(r => r.json())
        .then(d => { if (d && !d.error) setForm(d); })
        .catch(() => showToast('❌ Gagal memuat data', 'error'));
    }
  }, [editId]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000); 
  };

  const setField = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
      };

      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) { showToast('❌ Izin Mikrofon Ditolak', 'error'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const processAudio = async (blob: Blob) => {
    setAiLoading(true); setAiStep('🎙️ Transkripsi Audio...');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject; reader.readAsDataURL(blob);
      });
      const res = await fetch('/api/ai?action=transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' })
      });
      if (!res.ok) throw new Error('Gagal transkrip');
      const { transcript } = await res.json();
      setField('raw_transcript', (form.raw_transcript ? form.raw_transcript + '\n\n' : '') + transcript);
      await processTranscript(transcript);
    } catch (err: any) { showToast(`❌ ${err.message}`, 'error'); setAiLoading(false); setAiStep(''); }
  };

  // ====================================================================================
  // 🧠 SUPER AI PARSER: Memperbaiki Format AI yang Terpotong / Kehilangan Kurung Kurawal
  // ====================================================================================
  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt.trim()) return showToast('⚠️ Isi transcript (catatan mentah) terlebih dahulu', 'info');

    setAiLoading(true); setAiStep('🤖 Memeras Kecerdasan AI...');
    try {
      const res = await fetch('/api/ai?action=process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: txt, agenda: form.agenda, tempat: form.tempat, tanggal: form.tanggal, pimpinan: form.pimpinan_rapat })
      });
      
      let rawResult;
      try { rawResult = await res.json(); } catch(e) { throw new Error('Server mengembalikan data hancur'); }
      if (!res.ok) throw new Error(rawResult.error || 'Server Error');

      let finalJudul = '', finalIsi = '', finalKesimpulan = '', finalTindakLanjut = '';
      
      // Ambil string mentah dari AI
      let cleanStr = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
      cleanStr = cleanStr.replace(/```json/gi, '').replace(/```/gi, '').trim();

      // AUTO-HEAL: Jika AI lupa memberikan { } (Seperti kasus di gambar Anda)
      if (!cleanStr.startsWith('{') && cleanStr.includes('"judul_saran"')) {
        cleanStr = `{ ${cleanStr} }`;
      }

      try {
        // Percobaan Parsing Normal setelah disembuhkan
        const parsed = JSON.parse(cleanStr);
        finalJudul = parsed.judul_saran || parsed.judul || '';
        finalIsi = parsed.isi_notulen || parsed.isi || '';
        finalKesimpulan = parsed.kesimpulan || '';
        finalTindakLanjut = parsed.tindak_lanjut || parsed.tindaklanjut || '';
      } catch (e1) {
        // FALLBACK EKSTRIM: Regex Pencabut Data Otomatis
        const extract = (keys: string[]) => {
          for (let key of keys) {
            const regex = new RegExp(`"?${key}"?\\s*:\\s*"?([\\s\\S]*?)"?(?:,\\s*"\\w+"\\s*:|\\s*})`, 'i');
            const match = cleanStr.match(regex);
            if (match && match[1]) return match[1].trim().replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
          return '';
        };
        finalJudul = extract(['judul_saran', 'judul']);
        finalIsi = extract(['isi_notulen', 'isi']);
        finalKesimpulan = extract(['kesimpulan']);
        finalTindakLanjut = extract(['tindak_lanjut', 'tindaklanjut']);
        if (!finalIsi) finalIsi = cleanStr; // Jika benar-benar hancur
      }

      const formatText = (text: string) => text ? String(text).replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
      setForm(prev => ({
        ...prev,
        judul: finalJudul ? formatText(finalJudul) : prev.judul,
        isi_notulen: finalIsi ? formatText(finalIsi) : prev.isi_notulen,
        kesimpulan: finalKesimpulan ? formatText(finalKesimpulan) : prev.kesimpulan,
        tindak_lanjut: finalTindakLanjut ? formatText(finalTindakLanjut) : prev.tindak_lanjut,
      }));
      showToast('✅ Boom! Notulen Rapi Tersusun.', 'success');
    } catch (err: any) { showToast(`❌ Error: ${err.message}`, 'error'); } 
    finally { setAiLoading(false); setAiStep(''); }
  };

  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) return showToast('⚠️ Judul dan Tanggal Rapat wajib diisi!', 'error');
    setSaving(true);
    const finalStatus = statusOverride || form.status || 'draft';
    try {
      const payload = { ...form, status: finalStatus, raw_transcript: String(form.raw_transcript || '') };
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { ...payload, id: editId } : payload;
      
      const res = await fetch('/api/notulen', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`Gagal menyimpan (Error ${res.status})`);
      const saved = await res.json();
      
      showToast('✅ Tersimpan Cepat ke Database!', 'success');
      router.push(`/notulen/${saved.id || editId}`);
    } catch (err: any) { showToast(`❌ ${err.message}`, 'error'); setSaving(false); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#020617] overflow-x-hidden w-full text-slate-200 pb-20 md:pb-8 selection:bg-cyan-500/30">
      <Head>
        <title>{isEdit ? 'Edit' : 'Tambah'} Notulen AI — E-Laporan PKH Tapin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* TOAST SUPER CEPAT & HALUS */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full text-sm font-bold shadow-2xl transition-all duration-300 animate-bounce flex items-center gap-3 backdrop-blur-xl border
          ${toast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' : toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' : 'bg-[#061240]/90 border-cyan-500/40 text-cyan-100'}
        `}>
          {toast.msg}
        </div>
      )}

      {/* HEADER MOBILE & DESKTOP */}
      <nav className="border-b border-cyan-900/40 sticky top-0 z-40 backdrop-blur-2xl bg-[#020617]/90 w-full">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-cyan-900 transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              {isEdit ? 'EDIT NOTULEN' : 'NOTULEN BARU'}
            </h1>
          </div>
          <button onClick={() => handleSave('final')} disabled={saving}
            className="hidden md:flex px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-105 transition-transform shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            {saving ? 'Proses...' : 'Simpan Notulen'}
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        
        {/* PANEL KIRI: INFO & REKAMAN (GRID) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="rounded-2xl p-5 md:p-7 bg-slate-900/40 border border-slate-800 backdrop-blur-lg">
            <h2 className="text-cyan-400 font-bold mb-5 flex items-center gap-2"><span className="w-2 h-6 bg-cyan-500 rounded-full" /> Data Utama</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Judul Rapat *</label>
                <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)} placeholder="Contoh: Rapat Koordinasi..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none transition-all font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Tanggal</label>
                  <input type="date" value={form.tanggal} onChange={e => setField('tanggal', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Lokasi</label>
                  <input type="text" value={form.tempat} onChange={e => setField('tempat', e.target.value)} placeholder="Lokasi"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Pimpinan & Notulis</label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={form.pimpinan_rapat} onChange={e => setField('pimpinan_rapat', e.target.value)} placeholder="Pimpinan"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none" />
                  <input type="text" value={form.notulis} onChange={e => setField('notulis', e.target.value)} placeholder="Notulis"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5 md:p-7 bg-indigo-900/10 border border-indigo-900/50 backdrop-blur-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
             <h2 className="text-indigo-400 font-bold mb-5 flex items-center gap-2"><span className="w-2 h-6 bg-indigo-500 rounded-full" /> Kecerdasan Buatan (AI)</h2>
             
             {!recording ? (
                <button onClick={startRecording} disabled={aiLoading} className="w-full py-4 mb-4 rounded-xl font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 flex justify-center items-center gap-2 hover:bg-rose-500/20">
                  <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" /> Rekam Suara Langsung
                </button>
              ) : (
                <button onClick={stopRecording} className="w-full py-4 mb-4 rounded-xl font-bold bg-rose-600 text-white flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(225,29,72,0.5)]">
                  <div className="w-3 h-3 bg-white rounded-sm" /> Berhenti ({formatTime(recordingTime)})
                </button>
              )}

              <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                  placeholder="Ketik catatan rapat manual di sini, atau rekam suara di atas..."
                  className="w-full h-32 px-4 py-3 rounded-xl bg-slate-950/80 border border-indigo-800/50 focus:border-indigo-400 outline-none resize-none mb-4 text-sm font-mono text-indigo-100" />
              
              <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript}
                className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:scale-[1.01] transition-transform disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                {aiLoading ? ( <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sedang Memproses...</> ) : '✨ Rapikan dengan AI'}
              </button>
              {aiStep && <p className="text-center text-xs text-indigo-300 mt-3 font-semibold animate-pulse">{aiStep}</p>}
          </div>

        </div>

        {/* PANEL HASIL NOTULEN */}
        <div className="rounded-2xl p-5 md:p-7 bg-emerald-900/10 border border-emerald-900/40 backdrop-blur-lg">
           <h2 className="text-emerald-400 font-bold mb-5 flex items-center gap-2"><span className="w-2 h-6 bg-emerald-500 rounded-full" /> Hasil Notulen Rapi</h2>
           <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Isi Notulen Lengkap</label>
                <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)} rows={8}
                  className="w-full px-5 py-4 rounded-xl bg-slate-950 border border-emerald-800/50 focus:border-emerald-500 outline-none text-base leading-relaxed" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Kesimpulan</label>
                  <textarea value={form.kesimpulan} onChange={e => setField('kesimpulan', e.target.value)} rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-emerald-800/50 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Tindak Lanjut</label>
                  <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)} rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-emerald-800/50 focus:border-emerald-500 outline-none" />
                </div>
              </div>
           </div>
        </div>

      </div>

      {/* FLOATING ACTION BUTTON (MOBILE ONLY) */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#020617] to-transparent md:hidden z-50">
         <button onClick={() => handleSave('final')} disabled={saving}
            className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] flex justify-center items-center gap-2">
            {saving ? 'Menyimpan...' : '💾 SIMPAN NOTULEN'}
         </button>
      </div>
    </div>
  );
}
