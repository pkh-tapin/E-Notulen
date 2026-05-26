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
    setAiStep('🤖 AI sedang merapikan notulen...');

    try {
      const res = await fetch('/api/ai?action=process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: txt,
          agenda: form.agenda || 'Tidak ada agenda spesifik',
          tempat: form.tempat || 'Tidak ditentukan',
          tanggal: form.tanggal || new Date().toISOString().split('T')[0],
          pimpinan: form.pimpinan_rapat || 'Tidak ditentukan'
        })
      });
      const rawResult = await res.json();

      let finalJudul = '';
      let finalIsi = '';
      let finalKesimpulan = '';
      let finalTindakLanjut = '';

      // PERBAIKAN MUTLAK 3: Guard anti error replace pada respon AI
      const cleanAndParse = (str: any) => {
        if (!str || typeof str !== 'string') return null;
        try {
          const jsonMatch = str.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          const cleanStr = str.replace(/```json/gi, '').replace(/```/gi, '').trim();
          return JSON.parse(cleanStr);
        } catch (e) {
          console.warn("Gagal parse JSON AI:", e);
          return null;
        }
      };

      if (typeof rawResult === 'string') {
        const parsed = cleanAndParse(rawResult);
        if (parsed) {
          finalJudul = parsed.judul_saran || parsed.judul || '';
          finalIsi = parsed.isi_notulen || parsed.isi || '';
          finalKesimpulan = parsed.kesimpulan || '';
          finalTindakLanjut = parsed.tindak_lanjut || parsed.tindaklanjut || '';
        } else {
          finalIsi = rawResult; 
        }
      } 
      else if (rawResult && typeof rawResult.isi_notulen === 'string' && rawResult.isi_notulen.trim().startsWith('{')) {
        const parsedNested = cleanAndParse(rawResult.isi_notulen);
        if (parsedNested) {
          finalJudul = parsedNested.judul_saran || parsedNested.judul || rawResult.judul_saran || '';
          finalIsi = parsedNested.isi_notulen || parsedNested.isi || '';
          finalKesimpulan = parsedNested.kesimpulan || rawResult.kesimpulan || '';
          finalTindakLanjut = parsedNested.tindak_lanjut || parsedNested.tindaklanjut || rawResult.tindak_lanjut || '';
        } else {
          finalJudul = rawResult.judul_saran || rawResult.judul || '';
          finalIsi = rawResult.isi_notulen || '';
          finalKesimpulan = rawResult.kesimpulan || '';
          finalTindakLanjut = rawResult.tindak_lanjut || rawResult.tindaklanjut || '';
        }
      }
      else if (rawResult && typeof rawResult === 'object') {
        finalJudul = rawResult.judul_saran || rawResult.judul || '';
        finalIsi = rawResult.isi_notulen || rawResult.isi || '';
        finalKesimpulan = rawResult.kesimpulan || '';
        finalTindakLanjut = rawResult.tindak_lanjut || rawResult.tindaklanjut || '';
      }

      setForm(prev => ({
        ...prev,
        judul: prev.judul || finalJudul || prev.judul,
        isi_notulen: finalIsi || prev.isi_notulen,
        kesimpulan: finalKesimpulan || prev.kesimpulan,
        tindak_lanjut: finalTindakLanjut || prev.tindak_lanjut,
      }));

      showToast('✅ Notulen berhasil digenerate oleh AI!');
    } catch (err: any) {
      console.error("AI Error:", err);
      showToast(`❌ AI Error: ${err.message}`);
    } finally {
      setAiLoading(false);
      setAiStep('');
    }
  };

  const handleSave = async (statusOverride?: string) => {
    if (!form.judul || !form.tanggal) {
      showToast('⚠️ Judul dan tanggal wajib diisi');
      return;
    }

    setSaving(true);
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
        status: statusOverride || form.status || 'draft',
        raw_transcript: String(form.raw_transcript || '')
      };

      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { ...payload, id: editId } : payload;

      const res = await fetch('/api/notulen', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `HTTP Error ${res.status}`);
      }

      const saved = await res.json();
      showToast('✅ Notulen berhasil disimpan!');
      setTimeout(() => router.push(`/notulen/${saved.id || editId}`), 1200);
      
    } catch (err: any) {
      console.error("DEBUG SIMPAN:", err);
      showToast(`❌ Gagal: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Head>
        <title>{isEdit ? 'Edit' : 'Tambah'} Notulen — NotulenAI</title>
      </Head>

      <div className="min-h-screen grid-bg" style={{ background: '#020818' }}>
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium animate-slide-up"
            style={{ background: '#061240', border: '1px solid #22d3ee40', color: '#e2e8f0', boxShadow: '0 0 20px #22d3ee20' }}>
            {toast}
          </div>
        )}

        <nav className="border-b border-cyan-500/20 sticky top-0 z-40 backdrop-blur" style={{ background: '#040d2b95' }}>
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <span className="font-display text-lg font-semibold tracking-wider text-cyan-300">
                {isEdit ? 'EDIT' : 'TAMBAH'} <span className="text-white">NOTULEN</span>
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleSave('draft')} disabled={saving}
                className="px-4 py-2 rounded text-sm font-medium transition-all"
                style={{ background: '#374151', border: '1px solid #4b5563', color: '#9ca3af' }}>
                {saving ? 'Menyimpan...' : 'Simpan Draft'}
              </button>
              <button onClick={() => handleSave('final')} disabled={saving}
                className="px-4 py-2 rounded text-sm font-medium transition-all"
                style={{ background: '#22d3ee20', border: '1px solid #22d3ee50', color: '#22d3ee' }}>
                {saving ? 'Menyimpan...' : '✓ Finalisasi'}
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="card-futuristic rounded-xl p-6 animate-fade-up">
            <h2 className="font-display text-lg font-semibold text-cyan-300 tracking-wider mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded bg-cyan-400 inline-block" />
              INFORMASI RAPAT
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">Judul Rapat *</label>
                <input type="text" value={form.judul} onChange={e => setField('judul', e.target.value)}
                  placeholder="Contoh: Rapat Koordinasi Program Kerja 2025"
                  className="w-full px-4 py-2.5 rounded text-sm text-slate-200 placeholder-slate-600 outline-none"
                  style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }} />
              </div>
              {[
                { key: 'tanggal', label: 'Tanggal Rapat *', type: 'date' },
                { key: 'waktu_mulai', label: 'Waktu Mulai', type: 'time' },
                { key: 'waktu_selesai', label: 'Waktu Selesai', type: 'time' },
                { key: 'tempat', label: 'Tempat/Lokasi', type: 'text', placeholder: 'Contoh: Ruang Rapat Lantai 3' },
                { key: 'pimpinan_rapat', label: 'Pimpinan Rapat', type: 'text', placeholder: 'Nama pimpinan rapat' },
                { key: 'notulis', label: 'Notulis', type: 'text', placeholder: 'Nama notulis' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">{f.label}</label>
                  <input type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setField(f.key as keyof FormData, e.target.value)}
                    placeholder={(f as any).placeholder || ''}
                    className="w-full px-4 py-2.5 rounded text-sm text-slate-200 placeholder-slate-600 outline-none"
                    style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }} />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">Peserta Rapat</label>
                <textarea value={form.peserta} onChange={e => setField('peserta', e.target.value)}
                  placeholder="Daftar nama peserta, pisahkan dengan koma atau enter"
                  rows={3} className="w-full px-4 py-2.5 rounded text-sm text-slate-200 placeholder-slate-600 outline-none resize-none"
                  style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">Agenda Rapat</label>
                <textarea value={form.agenda} onChange={e => setField('agenda', e.target.value)}
                  placeholder="Agenda yang dibahas dalam rapat"
                  rows={2} className="w-full px-4 py-2.5 rounded text-sm text-slate-200 placeholder-slate-600 outline-none resize-none"
                  style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }} />
              </div>
            </div>
          </div>

          <div className="card-futuristic rounded-xl p-6 animate-fade-up">
            <h2 className="font-display text-lg font-semibold text-cyan-300 tracking-wider mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded bg-red-400 inline-block" />
              REKAM SUARA RAPAT
            </h2>

            <div className="flex items-center gap-4 mb-5">
              {!recording ? (
                <button onClick={startRecording} disabled={aiLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all"
                  style={{ background: '#ef444420', border: '1px solid #ef444450', color: '#ef4444' }}>
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  Mulai Rekam
                </button>
              ) : (
                <button onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium recording-pulse"
                  style={{ background: '#ef444430', border: '1px solid #ef4444', color: '#ef4444' }}>
                  <div className="w-3 h-3 rounded bg-red-400" />
                  Stop Rekam • {formatTime(recordingTime)}
                </button>
              )}

              <button onClick={() => processTranscript()} disabled={aiLoading || !form.raw_transcript}
                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all disabled:opacity-40"
                style={{ background: '#22d3ee20', border: '1px solid #22d3ee50', color: '#22d3ee' }}>
                {aiLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                    AI Memproses...
                  </>
                ) : (
                  <>✨ Rapikan dengan AI</>
                )}
              </button>
            </div>

            {aiStep && (
              <div className="mb-4 px-4 py-3 rounded text-sm text-cyan-300 font-mono cursor-blink"
                style={{ background: '#22d3ee10', border: '1px solid #22d3ee30' }}>
                {aiStep}
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">
                Transcript / Catatan Manual
                <span className="ml-2 text-slate-600">(bisa ketik manual atau hasil rekaman otomatis)</span>
              </label>
              <textarea value={form.raw_transcript} onChange={e => setField('raw_transcript', e.target.value)}
                placeholder="Ketik atau paste catatan rapat di sini. Mendukung Bahasa Indonesia dan Bahasa Banjar..."
                rows={6} className="w-full px-4 py-3 rounded text-sm text-slate-200 placeholder-slate-600 outline-none resize-none font-mono"
                style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }} />
            </div>
          </div>

          <div className="card-futuristic rounded-xl p-6 animate-fade-up">
            <h2 className="font-display text-lg font-semibold text-cyan-300 tracking-wider mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded bg-green-400 inline-block" />
              ISI NOTULEN
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">Isi Notulen Lengkap</label>
                <textarea value={form.isi_notulen} onChange={e => setField('isi_notulen', e.target.value)}
                  placeholder="I. PEMBUKAAN&#10;...&#10;&#10;II. PEMBAHASAN&#10;...&#10;&#10;III. PENUTUP&#10;..."
                  rows={12} className="w-full px-4 py-3 rounded text-sm text-slate-200 placeholder-slate-600 outline-none resize-none"
                  style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif', lineHeight: '1.7' }} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">Kesimpulan</label>
                <textarea value={form.kesimpulan} onChange={e => setField('kesimpulan', e.target.value)}
                  placeholder="Kesimpulan rapat yang telah diambil..."
                  rows={4} className="w-full px-4 py-3 rounded text-sm text-slate-200 placeholder-slate-600 outline-none resize-none"
                  style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-mono uppercase tracking-wider mb-1.5">Tindak Lanjut</label>
                <textarea value={form.tindak_lanjut} onChange={e => setField('tindak_lanjut', e.target.value)}
                  placeholder="1. Kegiatan A - PJ: Nama - Target: dd/mm/yyyy&#10;2. Kegiatan B - PJ: Nama - Target: dd/mm/yyyy"
                  rows={4} className="w-full px-4 py-3 rounded text-sm text-slate-200 placeholder-slate-600 outline-none resize-none font-mono"
                  style={{ background: '#040d2b', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }} />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div>
                  <select value={form.status} onChange={e => setField('status', e.target.value)}
                    className="px-3 py-2 rounded text-sm outline-none"
                    style={{ background: '#040d2b', border: '1px solid #22d3ee20', color: '#e2e8f0', fontFamily: 'Exo 2, sans-serif' }}>
                    <option value="draft">📝 Draft</option>
                    <option value="review">👁️ Review</option>
                    <option value="final">✅ Final</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleSave()} disabled={saving}
                    className="px-6 py-2.5 rounded text-sm font-medium transition-all"
                    style={{ background: '#22d3ee20', border: '1px solid #22d3ee50', color: '#22d3ee' }}>
                    {saving ? 'Menyimpan...' : '💾 Simpan Notulen'}
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
