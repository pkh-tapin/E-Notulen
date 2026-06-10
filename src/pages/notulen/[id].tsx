import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

interface NotulenData {
  id?: string;
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
}

export default function LaporanResmi() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<NotulenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (id) {
      fetch(`/api/notulen?id=${id}`)
        .then(res => res.json())
        .then(result => {
          if (Array.isArray(result)) {
            const found = result.find((item: any) => item.id === id);
            setData(found || null);
          } else {
            setData(result.error ? null : result);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  const generatePDF = async () => {
    if (!data) return;
    setPrinting(true);

    const printArea = document.getElementById('formal-report-area');
    if (!printArea) return;

    const opt = {
      margin: [15, 15, 15, 15],
      filename: `LAPORAN_NOTULEN_${data.tanggal.replace(/-/g, '')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const runPDF = async () => {
      try {
        await (window as any).html2pdf().set(opt).from(printArea).save();
      } catch (err) {
        console.error("Gagal mencetak PDF", err);
      } finally {
        setPrinting(false);
      }
    };

    if (!(window as any).html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runPDF;
      document.head.appendChild(script);
    } else {
      runPDF();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold tracking-widest text-xs uppercase">Menarik Data Enkripsi...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <h1 className="text-2xl font-black text-slate-800 mb-2">404 - Dokumen Hilang</h1>
        <p className="text-slate-500 mb-6">Arsip yang Anda cari tidak ditemukan di database utama.</p>
        <Link href="/" className="px-6 py-2 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30">Kembali ke Dashboard</Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Laporan Resmi: {data.judul}</title>
      </Head>

      <div className="min-h-screen bg-[#f8fafc] w-full text-slate-800 font-sans pb-12">
        
        {/* Navbar */}
        <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 w-full shadow-sm print:hidden">
          <div className="w-full max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-slate-500 hover:text-orange-500 transition-colors font-bold text-xs uppercase tracking-widest">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Kembali
            </Link>
            <button onClick={generatePDF} disabled={printing} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition-all bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2">
              {printing ? 'Memproses PDF...' : '📥 Download Laporan PDF'}
            </button>
          </div>
        </nav>

        {/* Kontainer Preview Laporan */}
        <div className="w-full max-w-4xl mx-auto mt-8 px-4 print:p-0 print:m-0">
          
          {/* AREA CETAK PDF (Desain Dokumen Resmi) */}
          <div id="formal-report-area" className="bg-white p-10 md:p-14 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0">
            
            {/* KOP SURAT (Otomatis disesuaikan untuk format resmi) */}
            <div className="text-center border-b-[3px] border-double border-slate-800 pb-5 mb-8">
              <h1 className="font-extrabold text-lg md:text-xl uppercase tracking-wider text-slate-900 leading-tight">
                LAPORAN HASIL KEGIATAN & NOTULENSI
              </h1>
              <h2 className="font-bold text-sm md:text-base uppercase tracking-widest text-slate-700 mt-1">
                SDM PROGRAM KELUARGA HARAPAN (PKH)
              </h2>
              <p className="font-semibold text-xs md:text-sm uppercase tracking-widest text-slate-600 mt-1">
                KABUPATEN TAPIN
              </p>
            </div>

            {/* 1. PEMBUKAAN (Metadata) */}
            <div className="mb-8">
              <h3 className="font-bold text-sm text-slate-900 bg-slate-100 p-2 border-l-4 border-orange-500 uppercase tracking-widest mb-4">I. Pembukaan & Identitas Rapat</h3>
              <table className="w-full text-sm text-slate-800">
                <tbody>
                  <tr className="border-b border-slate-100"><td className="py-2 w-40 font-semibold align-top">Kegiatan / Judul</td><td className="py-2 w-4 align-top">:</td><td className="py-2 font-bold">{data.judul}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-2 w-40 font-semibold align-top">Hari, Tanggal</td><td className="py-2 w-4 align-top">:</td><td className="py-2">{data.tanggal}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-2 w-40 font-semibold align-top">Waktu</td><td className="py-2 w-4 align-top">:</td><td className="py-2">{data.waktu_mulai || '-'} s/d {data.waktu_selesai || 'Selesai'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-2 w-40 font-semibold align-top">Lokasi / Tempat</td><td className="py-2 w-4 align-top">:</td><td className="py-2">{data.tempat || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-2 w-40 font-semibold align-top">Pimpinan Rapat</td><td className="py-2 w-4 align-top">:</td><td className="py-2">{data.pimpinan_rapat || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-2 w-40 font-semibold align-top">Agenda Utama</td><td className="py-2 w-4 align-top">:</td><td className="py-2 whitespace-pre-wrap">{data.agenda || '-'}</td></tr>
                </tbody>
              </table>
            </div>

            {/* 2. PEMBAHASAN */}
            <div className="mb-8">
              <h3 className="font-bold text-sm text-slate-900 bg-slate-100 p-2 border-l-4 border-orange-500 uppercase tracking-widest mb-4">II. Hasil Pembahasan</h3>
              <div className="text-sm text-slate-800 leading-loose text-justify whitespace-pre-wrap pl-2 border-l-2 border-slate-200">
                {data.isi_notulen || 'Tidak ada catatan pembahasan.'}
              </div>
            </div>

            {/* 3. KESIMPULAN (Di-desain menonjol dan padat) */}
            <div className="mb-8">
              <h3 className="font-bold text-sm text-slate-900 bg-slate-100 p-2 border-l-4 border-red-500 uppercase tracking-widest mb-4">III. Kesimpulan Eksekutif</h3>
              <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-lg text-sm text-slate-900 font-semibold leading-relaxed text-justify shadow-inner">
                {data.kesimpulan || 'Tidak ada kesimpulan yang dicatat.'}
              </div>
            </div>

            {/* 4. TINDAK LANJUT */}
            <div className="mb-12">
              <h3 className="font-bold text-sm text-slate-900 bg-slate-100 p-2 border-l-4 border-slate-800 uppercase tracking-widest mb-4">IV. Rencana Tindak Lanjut (RTL)</h3>
              <div className="text-sm text-slate-800 leading-loose text-justify whitespace-pre-wrap pl-2 border-l-2 border-slate-200">
                {data.tindak_lanjut || '-'}
              </div>
            </div>

            {/* KOLOM TANDA TANGAN */}
            <div className="mt-16 flex justify-end">
              <div className="text-center w-64">
                <p className="text-sm text-slate-800 mb-20">Tapin, {data.tanggal}</p>
                <p className="font-bold text-sm text-slate-900 border-b border-slate-800 inline-block pb-0.5">{data.pimpinan_rapat || '...........................................'}</p>
                <p className="text-xs text-slate-600 mt-1">Pimpinan Rapat</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}