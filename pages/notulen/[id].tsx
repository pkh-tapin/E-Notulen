import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Notulen {
  id: string;
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
  created_at: string;
}

export default function LihatNotulen() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<Notulen | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/notulen?id=${id}`)
      .then(r => r.json())
      .then(d => { 
        setData(d); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }, [id]);

  // --- ENGINE PARSER OTOMATIS: MENANGANI STRINGS/OBJECT JSON DARI GEMINI AI ---
  const formatContent = (rawText: string) => {
    if (!rawText) return <p className="text-gray-400 italic">Tidak ada data pembahasan.</p>;

    let textToRender = rawText;

    // Deteksi jika teks merupakan JSON mentah akibat belum diparse saat penyimpanan
    if (typeof rawText === 'string' && rawText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawText);
        // Ambil isi spesifik bidang teks jika ada di objek hasil parse
        textToRender = parsed.isi_notulen || parsed.isi || parsed.kesimpulan || parsed.tindak_lanjut || Object.values(parsed)[0];
      } catch (e) {
        console.error("Gagal melakukan auto-parsing JSON string:", e);
      }
    }

    // Pastikan hasil akhir dikonversi ke tipe string dan hapus escape karakter mentah (\n)
    const secureString = String(textToRender).replace(/\\n/g, '\n');

    // Pemrosesan Baris & Pemformatan Karya Ilmiah Terstruktur (A. 1. a. 1))
    return secureString.split('\n').map((line, i) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return <div key={i} className="h-2" />;

      // Hapus simbol markdown bintang atau strip jika ada di awal baris
      const cleanText = trimmedLine.replace(/^[\*\-\u2022]\s*/, '').trim();

      // Deteksi Header Utama Romawi (misal: I. PEMBUKAAN)
      if (/^[IVXLCDM]+\.\s+/i.test(trimmedLine)) {
        return (
          <h3 key={i} className="text-sm font-bold text-purple-300 mt-4 mb-2 tracking-wide uppercase border-b border-purple-500/10 pb-1">
            {cleanText}
          </h3>
        );
      }

      // Deteksi Sub-Bab Abjad Besar (A., B., C., dst.)
      if (/^[A-Z]\.\s+/.test(trimmedLine)) {
        return (
          <div key={i} className="font-semibold text-white pl-2 mt-2 mb-1 text-sm flex gap-1">
            <span>{trimmedLine.match(/^[A-Z]\./)?.[0]}</span>
            <span className="text-justify">{trimmedLine.replace(/^[A-Z]\.\s*/, '')}</span>
          </div>
        );
      }

      // Deteksi Penomoran Angka (1., 2., 3., dst.)
      if (/^\d+\.\s+/.test(trimmedLine)) {
        return (
          <div key={i} className="text-purple-200/90 pl-6 mb-1 text-sm flex gap-1.5">
            <span className="font-mono text-purple-400 font-medium">{trimmedLine.match(/^\d+\./)?.[0]}</span>
            <span className="text-justify">{trimmedLine.replace(/^\d+\.\s*/, '')}</span>
          </div>
        );
      }

      // Deteksi Penomoran Abjad Kecil (a., b., c., dst.)
      if (/^[a-z]\.\s+/.test(trimmedLine)) {
        return (
          <div key={i} className="text-gray-300 pl-10 mb-1 text-[13px] flex gap-1.5">
            <span className="font-mono text-fuchsia-400 font-medium">{trimmedLine.match(/^[a-z]\./)?.[0]}</span>
            <span className="text-justify">{trimmedLine.replace(/^[a-z]\.\s*/, '')}</span>
          </div>
        );
      }

      // Paragraf Normal / Teks Penjelas
      return (
        <p key={i} className="text-gray-300 text-sm leading-relaxed text-justify pl-6 mb-2">
          {cleanText}
        </p>
      );
    });
  };

  const handleCopyText = () => {
    if (!data) return;
    let cleanNotes = data.isi_notulen;
    if (cleanNotes.trim().startsWith('{')) {
      try { cleanNotes = JSON.parse(cleanNotes).isi_notulen || cleanNotes; } catch {}
    }
    const textToCopy = `NOTULEN RAPAT: ${data.judul}\n` + 
      `Hari/Tanggal: ${data.tanggal ? format(parseISO(data.tanggal), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}\n\n` +
      `ISI NOTULEN:\n${cleanNotes.replace(/\\n/g, '\n')}`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0f19' }}><div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-400 rounded-full animate-spin"></div></div>;
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center text-white font-medium" style={{ background: '#0b0f19' }}>Data tidak ditemukan.</div>;

  return (
    <>
      <Head>
        <title>{data.judul} — Arsip Digital</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body {
            background: linear-gradient(135deg, #090d16 0%, #111726 100%);
            font-family: 'Inter', sans-serif;
            color: #f3f4f6;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
          }
          .glass-sheet {
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 24px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.6);
          }
          .section-marker {
            color: #c4b5fd;
            font-weight: 700;
            font-size: 0.85rem;
            letter-spacing: 0.1em;
            margin-bottom: 0.75rem;
            margin-top: 2rem;
            border-left: 3px solid #8b5cf6;
            padding-left: 10px;
            text-transform: uppercase;
          }
        `}</Head>

      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <Link href="/">
          <button className="text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/10 px-4 py-2 rounded-xl transition flex items-center gap-1.5 mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Kembali ke Dashboard
          </button>
        </Link>
        
        <div className="glass-sheet p-6 md:p-10">
          <div className="text-center border-b border-white/5 pb-6 mb-6">
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">MANUSKRIP HASIL AI</span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-3 mb-4 tracking-tight leading-snug">{data.judul}</h1>
            <button onClick={handleCopyText} className="text-xs font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:opacity-90 flex items-center gap-2 mx-auto shadow-md" style={{ background: copied ? '#10b981' : 'linear-gradient(135deg, #a78bfa, #6d28d9)' }}>
              {copied ? '✓ Berhasil Disalin' : '⚡ Salin Konten'}
            </button>
          </div>

          {/* Meta Info Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/20 p-4 rounded-xl border border-white/5 mb-4">
            <div><label className="block text-purple-400 text-[10px] font-bold tracking-wider uppercase mb-0.5">TANGGAL</label><div className="text-xs font-semibold text-white">{data.tanggal ? format(parseISO(data.tanggal), 'dd MMMM yyyy', { locale: idLocale }) : '-'}</div></div>
            <div><label className="block text-purple-400 text-[10px] font-bold tracking-wider uppercase mb-0.5">LOKASI</label><div className="text-xs font-semibold text-white truncate">{data.tempat || '-'}</div></div>
            <div><label className="block text-purple-400 text-[10px] font-bold tracking-wider uppercase mb-0.5">PIMPINAN</label><div className="text-xs font-semibold text-white truncate">{data.pimpinan_rapat || '-'}</div></div>
            <div><label className="block text-purple-400 text-[10px] font-bold tracking-wider uppercase mb-0.5">NOTULIS</label><div className="text-xs font-semibold text-white truncate">{data.notulis || '-'}</div></div>
          </div>

          {/* Dynamic Content Structure */}
          <div className="section-marker">Isi Pembahasan Utama</div>
          <div className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl">{formatContent(data.isi_notulen)}</div>

          <div className="section-marker">Kesimpulan Strategis</div>
          <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-4 rounded-xl">{formatContent(data.kesimpulan)}</div>

          <div className="section-marker">Rencana Tindak Lanjut (RTL)</div>
          <div className="bg-amber-500/[0.02] border border-amber-500/10 p-4 rounded-xl">{formatContent(data.tindak_lanjut)}</div>
        </div>
      </div>
    </>
  );
}
