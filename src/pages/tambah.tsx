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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (editId) {
      fetch(`/api/notulen`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const found = data.find((item: any) => item.id === editId);
            if (found) setForm(found);
          } else if (data && !data.error) {
            setForm(data);
          }
        })
        .catch(console.error);
    }
  }, [editId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000); 
  };

  const setField = (key: keyof FormData, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

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
    } catch (err) {
      showToast('Akses mikrofon ditolak.');
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
    showToast('Memproses sinyal suara...');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const transcribeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "Tolong transkrip ini jika API mendukung base64", audioBase64: base64 }) 
      });
      
      const resText = await transcribeRes.text();
      const transcript = JSON.parse(resText).transcript || "Transkripsi otomatis berhasil dideteksi.";
      setField('raw_transcript', (form.raw_transcript ? form.raw_transcript + '\n\n' : '') + transcript);
      await processTranscript(transcript);
    } catch (err: any) {
      showToast(`Transkripsi Audio Gagal, coba ketik manual.`);
      setAiLoading(false);
    }
  };

  const processTranscript = async (transcript?: string) => {
    const txt = transcript || form.raw_transcript;
    if (!txt || typeof txt !== 'string' || !txt.trim()) return showToast('Teks rekaman masih kosong!');

    setAiLoading(true);
    showToast('Menghubungkan ke Mesin AI...');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: txt, agenda: form.agenda })
      });
      
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);

      const aiOut = resData.data;

      const formatString = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (Array.isArray(val)) return val.map(item => `• ${item}`).join('\n').trim();
        return String(val);
      };

      setForm(prev => ({
        ...prev,
        isi_notulen: formatString(aiOut.poin_penting) || prev.isi_notulen,
        kesimpulan: formatString(aiOut.ringkasan) || prev.kesimpulan,
        tindak_lanjut: formatString(aiOut.tindak_lanjut) || prev.tindak_lanjut,
      }));

      showToast('Notulen Berhasil Dirapikan AI!');
    } catch (err: any) {
      showToast(`AI Error: Cek Koneksi / Saldo API`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) return showToast('Judul & Tanggal Wajib Diisi!');
    setSaving(true);
    try {
      const payload = { ...form, status: statusOverride || form.status || 'draft' };
      const method = isEdit ? 'PUT' : 'POST';
      const bodyPayload = isEdit ? { ...payload, id: editId } : payload;

      const res = await fetch('/api/notulen', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) throw new Error('Database Gagal Menyimpan');
      showToast('Dokumen Berhasil Tersimpan!');
      setTimeout(() => router.push(`/`), 1500);
      
    } catch (err: any) {
      showToast(`Sistem Database Error`);
    } finally {
      setSaving(false);
    }
  };

  const countWords = (text: any) => {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{`${isEdit ? 'Edit Notulen' : 'Catatan Baru'} — AI Note`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
          @keyframes pulseGlow { 0%, 100% { opacity: 1; text-shadow: 0 0 15px rgba(234,179,8,0.5); } 50% { opacity: 0.7; text-shadow: 0 0 5px rgba(234,179,8,0.2); } }
        `}</style>
      </Head>

      <div className="min-h-screen bg-slate-50 w-full text-slate-800 font-sans pb-12 selection:bg-yellow-200">
        
        {/* MODERN GLASSMORPHISM TOAST */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-[slideUp_0.4s_ease-out] flex items-center gap-3 w-[90%] md:w-auto max-w-md justify-center">
            {toast.includes('Error') || toast.includes('Gagal') || toast.includes('Wajib') || toast.includes('ditolak') ? (
              <i className="fa-solid fa-triangle-exclamation text-red-500 text-lg"></i>
            ) : toast.includes('Memproses') || toast.includes('Menghubungkan') ? (
              <i className="fa-solid fa-circle-notch fa-spin text-yellow-400 text-lg"></i>
            ) : (
              <i className="fa-solid fa-circle-check text-emerald-400 text-lg"></i>
            )}
            <span className="text-white font-medium tracking-wide text-xs sm:text-sm text-center">{toast}</span>
          </div>
        )}

        {/* TOP NAVBAR */}
        <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 w-full shadow-sm">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/" className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-yellow-100 text-slate-500 hover:text-yellow-600 transition-colors">
                <i className="fa-solid fa-arrow-left"></i>
              </Link>
              <h1 className="font-extrabold text-slate-800 text-xs sm:text-sm tracking-widest uppercase">
                {isEdit ? 'EDIT' : 'BUAT'} <span className="text-yellow-500">DOKUMEN</span>
              </h1>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={() => handleSave('draft')} disabled={saving} className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-2">
                <i className="fa-solid fa-file-pen hidden sm:block"></i> Draft
              </button>
              <button onClick={() => handleSave(form.status === 'rahasia' ? 'rahasia' : 'final')} disabled={saving} className="px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase transition-all bg-yellow-400 text-yellow-950 shadow-md shadow-yellow-400/30 hover:bg-yellow-500 hover:-translate-y-0.5 flex items-center gap-2">
                {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                <span className="hidden sm:inline">{saving ? 'Menyimpan...' : 'Simpan Final'}</span>
                <span className="sm:hidden">{saving ? '...' : 'Simpan'}</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          
          {/* KOLOM KIRI (Metadata & Studio Rekaman) */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-300"></div>
              <h2 className="text-xs font-bold text-slate-500 tracking-widest mb-6 uppercase flex items-center gap-2 border-b border-slate-100 pb-3">
                <i className="fa-solid fa-clipboard-list text-slate-400 text-base"></i> Identitas Rapat
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Judul Dokumen *</label>
                  <div className="relative">
                    <i className="fa-solid fa-heading absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" value={form.judul || ''} onChange={e => setField('judul', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-300 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 transition-all shadow-inner" placeholder="Contoh: Rapat Koordinasi PKH..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Tanggal *</label>
                    <div className="relative">
                      <i className="fa-regular fa-calendar absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input type="date" value={form.tanggal || ''} onChange={e => setField('tanggal', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Lokasi</label>
                    <div className="relative">
                      <i className="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input type="text" value={form.tempat || ''} onChange={e => setField('tempat', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium" placeholder="Aula Dinas..." />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Pimpinan Rapat</label>
                    <div className="relative">
                      <i className="fa-solid fa-user-tie absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input type="text" value={form.pimpinan_rapat || ''} onChange={e => setField('pimpinan_rapat', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Notulis</label>
                    <div className="relative">
                      <i className="fa-solid fa-pen-nib absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input type="text" value={form.notulis || ''} onChange={e => setField('notulis', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium" />
                    </div>
                  </div>
                </div>

                {/* FORM INPUT KHUSUS ADMIN (STATUS RAHASIA) */}
                <div className="pt-2">
                  <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5 text-yellow-600 flex items-center gap-1.5">
                    <i className="fa-solid fa-shield-halved"></i> Status Keamanan Dokumen
                  </label>
                  <select 
                    value={form.status || 'draft'} 
                    onChange={e => setField('status', e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="draft">📝 DRAFT (Konsep)</option>
                    <option value="review">👁️ REVIEW (Sedang Diperiksa)</option>
                    <option value="final">✅ FINAL (Dapat Dilihat Publik)</option>
                    <option value="rahasia" className="text-red-600 font-extrabold">🔒 RAHASIA (Hanya Admin Vault)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Agenda / Tema Utama</label>
                  <textarea value={form.agenda || ''} onChange={e => setField('agenda', e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium resize-none shadow-inner" placeholder="Bahas apa hari ini?..." />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-1.5 h-full bg-yellow-400"></div>
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase flex items-center gap-2">
                  <i className="fa-solid fa-microphone-lines text-yellow-500 text-base"></i> Studio AI
                </h2>
                <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-md border border-yellow-200">
                  {countWords(form.raw_transcript)} KATA
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                {!recording ? (
                  <button onClick={startRecording} disabled={aiLoading} className="flex-1 px-4 py-3.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center justify-center gap-2 shadow-sm">
                    <i className="fa-solid fa-microphone text-sm"></i> Rekam Suara
                  </button>
                ) : (
                  <button onClick={stopRecording} className="flex-1 px-4 py-3.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase bg-red-50 text-red-600 border border-red-200 animate-pulse flex items-center justify-center gap-2 shadow-sm">
                    <i className="fa-solid fa-stop text-sm"></i> Stop • {formatTime(recordingTime)}
                  </button>
                )}
                <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript} className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-[11px] sm:text-xs font-extrabold uppercase transition-all bg-slate-900 text-white shadow-md hover:bg-slate-800 disabled:opacity-40">
                  {aiLoading ? (
                    <><i className="fa-solid fa-circle-notch fa-spin text-yellow-400 text-base"></i> Menganalisa...</>
                  ) : (
                    <><i className="fa-solid fa-wand-magic-sparkles text-yellow-400 text-base"></i> Rapikan AI</>
                  )}
                </button>
              </div>

              <textarea value={form.raw_transcript || ''} onChange={e => setField('raw_transcript', e.target.value)} placeholder="Ketik manual di sini atau gunakan fitur Rekam Suara. Teks ini akan diolah oleh kecerdasan buatan..." rows={5} className="w-full flex-1 px-5 py-4 rounded-xl text-sm text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 transition-all leading-relaxed resize-none shadow-inner" />
            </div>
          </div>

          {/* KOLOM KANAN (HASIL DOKUMEN OTOMATIS) */}
          <div className="lg:col-span-7 relative">
            
            {/* CINEMATIC AI LOADING OVERLAY */}
            {aiLoading && (
              <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center border border-yellow-200 shadow-2xl">
                <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-4 border-yellow-400 rounded-full animate-ping opacity-20"></div>
                  <div className="absolute inset-2 border-4 border-yellow-400 rounded-full animate-ping opacity-40" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-16 h-16 bg-gradient-to-tr from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg shadow-yellow-400/50 relative z-10">
                    <i className="fa-solid fa-brain text-white text-3xl animate-pulse"></i>
                  </div>
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2" style={{ animation: 'pulseGlow 2s infinite' }}>Memproses Data...</h3>
                <p className="text-slate-600 text-sm font-medium text-center px-8">Kecerdasan Buatan sedang menyusun notulensi Anda secara otomatis.</p>
              </div>
            )}

            <div className={`bg-white rounded-2xl p-5 sm:p-8 border border-slate-200 shadow-sm relative h-full transition-opacity duration-300 ${aiLoading ? 'opacity-30' : 'opacity-100'}`}>
              <h2 className="text-xs font-bold text-slate-500 tracking-widest mb-6 border-b border-slate-100 pb-4 uppercase flex items-center gap-2">
                <i className="fa-solid fa-file-signature text-slate-400 text-base"></i> Hasil Dokumen Otomatis
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-800 text-[10px] uppercase font-extrabold tracking-widest mb-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-list-check text-yellow-500"></i> Poin Pembahasan Rapat
                  </label>
                  <textarea value={form.isi_notulen || ''} onChange={e => setField('isi_notulen', e.target.value)} rows={9} className="w-full px-5 py-4 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 transition-all leading-loose text-justify shadow-inner whitespace-pre-wrap" />
                </div>
                <div>
                  <label className="block text-slate-800 text-[10px] uppercase font-extrabold tracking-widest mb-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-bolt text-yellow-500"></i> Kesimpulan Eksekutif
                  </label>
                  <textarea value={form.kesimpulan || ''} onChange={e => setField('kesimpulan', e.target.value)} rows={3} className="w-full px-5 py-4 rounded-xl text-sm text-slate-800 bg-yellow-50/50 border border-yellow-200 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 transition-all leading-relaxed text-justify shadow-inner whitespace-pre-wrap font-medium" />
                </div>
                <div>
                  <label className="block text-slate-800 text-[10px] uppercase font-extrabold tracking-widest mb-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-forward-step text-yellow-500"></i> Tindak Lanjut (RTL)
                  </label>
                  <textarea value={form.tindak_lanjut || ''} onChange={e => setField('tindak_lanjut', e.target.value)} rows={3} className="w-full px-5 py-4 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 transition-all leading-relaxed text-justify shadow-inner whitespace-pre-wrap" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}