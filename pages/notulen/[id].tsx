import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function DetailNotulen() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetch(`/api/notulen?id=${id}`)
        .then(res => res.json())
        .then(resData => {
          if (!resData.error) setData(resData);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [id]);

  // =========================================================================
  // PERBAIKAN EXPORT PDF: Format Resmi Instansi Latar Putih & Anti Error
  // =========================================================================
  const handleDownloadPDF = () => {
    if (!data) return;
    setIsPdfLoading(true);

    // Membuat elemen HTML tersembunyi berformat laporan dinas
    const reportContainer = document.createElement('div');
    reportContainer.style.position = 'fixed';
    reportContainer.style.left = '-9999px';
    reportContainer.style.top = '-9999px';
    reportContainer.innerHTML = `
      <div id="print-official-pdf" style="padding: 20mm 15mm; font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; line-height: 1.5; font-size: 12pt;">
        
        <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase;">LAPORAN NOTULEN RAPAT</h2>
          <p style="margin: 5px 0 0 0; font-size: 11pt;">Sistem Dokumentasi Arsip Digital Terpadu</p>
        </div>

        <h3 style="text-align: center; margin-bottom: 25px; text-transform: uppercase; font-size: 14pt;">${data.judul || 'Dokumen Rapat'}</h3>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11pt;">
          <tr>
            <td style="width: 25%; font-weight: bold; padding: 4px 0; vertical-align: top;">Tanggal</td>
            <td style="width: 3%; vertical-align: top;">:</td>
            <td style="padding: 4px 0; vertical-align: top;">${data.tanggal || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Waktu</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 4px 0; vertical-align: top;">${data.waktu_mulai || '-'} s.d. ${data.waktu_selesai || 'Selesai'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Tempat</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 4px 0; vertical-align: top;">${data.tempat || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Pimpinan Rapat</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 4px 0; vertical-align: top;">${data.pimpinan_rapat || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Notulis</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 4px 0; vertical-align: top;">${data.notulis || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Peserta Rapat</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 4px 0; vertical-align: top; white-space: pre-wrap;">${data.peserta || '-'}</td>
          </tr>
        </table>

        <div style="margin-bottom: 20px;">
          <h4 style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 8px;">I. AGENDA RAPAT</h4>
          <p style="margin: 0; white-space: pre-wrap; text-align: justify; padding-left: 15px;">${data.agenda || '-'}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 8px;">II. JALANNYA RAPAT / PEMBAHASAN</h4>
          <div style="margin: 0; white-space: pre-wrap; text-align: justify; padding-left: 15px;">${data.isi_notulen || '-'}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 8px;">III. KESIMPULAN</h4>
          <p style="margin: 0; white-space: pre-wrap; text-align: justify; padding-left: 15px;">${data.kesimpulan || '-'}</p>
        </div>

        <div style="margin-bottom: 40px;">
          <h4 style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 8px;">IV. TINDAK LANJUT</h4>
          <p style="margin: 0; white-space: pre-wrap; font-family: monospace; padding-left: 15px;">${data.tindak_lanjut || '-'}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
          <tr>
            <td style="width: 50%; text-align: center; padding-bottom: 70px;">Pimpinan Rapat,</td>
            <td style="width: 50%; text-align: center; padding-bottom: 70px;">Notulis,</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold; text-decoration: underline;">( ${data.pimpinan_rapat || '........................'} )</td>
            <td style="text-align: center; font-weight: bold; text-decoration: underline;">( ${data.notulis || '........................'} )</td>
          </tr>
        </table>
      </div>
    `;

    document.body.appendChild(reportContainer);

    const opt = {
      margin:       0,
      filename:     `Laporan_Notulen_${data?.tanggal || 'Rapat'}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const processExport = () => {
      (window as any).html2pdf().set(opt).from(document.getElementById('print-official-pdf')).save().then(() => {
        setIsPdfLoading(false);
        document.body.removeChild(reportContainer);
      }).catch((err: any) => {
        console.error("PDF Error:", err);
        alert("Terjadi kesalahan saat memproses PDF.");
        setIsPdfLoading(false);
        document.body.removeChild(reportContainer);
      });
    };

    if (!(window as any).html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = processExport;
      document.head.appendChild(script);
    } else {
      processExport();
    }
  };

  // Logika Gembok Rahasia Admin
  const handleAdminLock = () => {
    if (isAdmin) {
      setIsAdmin(false);
      return;
    }
    const pin = prompt("Masukkan PIN Admin (Default: 1234):");
    if (pin === "1234") setIsAdmin(true);
    else if (pin !== null) alert("PIN Salah!");
  };

  if (loading) return <div className="min-h-screen bg-[#020818] text-cyan-300 flex items-center justify-center font-mono">Loading Data...</div>;
  if (!data) return <div className="min-h-screen bg-[#020818] text-red-500 flex items-center justify-center font-mono">⚠️ Data Tidak Ditemukan</div>;

  return (
    <>
      <Head>
        <title>{data?.judul || 'Detail'} - Arsip Digital</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&display=swap');
          body {
            background: linear-gradient(135deg, #020818 0%, #0a1536 100%);
            font-family: 'Exo 2', sans-serif;
          }
        `}</style> 
      </Head>

      <div className="min-h-screen text-slate-200 w-full overflow-x-hidden font-sans pb-10">
        
        {/* ========================================================================= */}
        {/* NAVBAR SUPER LENGKAP & KONTROL ADMIN (TIDAK ADA YANG DIKURANGI) */}
        {/* ========================================================================= */}
        <nav className="border-b border-cyan-500/20 sticky top-0 z-40 backdrop-blur-xl bg-[#040d2b]/90 w-full shadow-lg print:hidden">
          <div className="w-full max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors font-bold tracking-wider flex items-center gap-2 text-sm md:text-base">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              <span className="hidden md:inline">KEMBALI KE DASHBOARD</span>
              <span className="md:hidden">KEMBALI</span>
            </Link>
            
            <div className="flex gap-3 items-center">
              {/* TOMBOL GEMBOK ADMIN */}
              <button 
                onClick={handleAdminLock} 
                className={`p-2 rounded-lg transition-all border ${isAdmin ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300' : 'bg-transparent border-transparent text-slate-500 hover:text-cyan-400'}`}
                title="Akses Admin"
              >
                {isAdmin ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                )}
              </button>
              
              {/* TOMBOL EDIT (HANYA MUNCUL JIKA GEMBOK DIBUKA) */}
              {isAdmin && (
                <Link href={`/tambah?edit=${id}`} className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 text-sm hover:bg-blue-500/30 transition-all font-semibold shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                  Edit Data
                </Link>
              )}
              
              {/* TOMBOL EXPORT PDF */}
              <button 
                onClick={handleDownloadPDF} 
                disabled={isPdfLoading}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-white font-semibold text-sm hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-2 disabled:opacity-50"
              >
                {isPdfLoading ? (
                  <><span className="animate-spin text-lg">⏳</span> Memproses...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> <span className="hidden md:inline">Download PDF Resmi</span><span className="md:hidden">PDF</span></>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* TAMPILAN LAYAR APLIKASI (TETAP GLASSMORPHISM & TEMA GELAP) */}
        {/* ========================================================================= */}
        <div className="w-full max-w-5xl mx-auto px-6 py-10 space-y-6">
          
          <div className="rounded-xl p-8 backdrop-blur-lg bg-[#040d2b]/80 border border-cyan-900/60 shadow-[0_0_20px_rgba(34,211,238,0.08)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
            
            <div className="mb-8 border-b border-cyan-900/40 pb-6">
              <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-md border mb-4 ${data.status === 'final' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/30'}`}>
                STATUS: {data.status || 'DRAFT'}
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-snug">{data.judul}</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-cyan-500/70 text-xs font-bold uppercase tracking-wider mb-1">Tanggal</p>
                <p className="font-medium text-slate-200 text-sm md:text-base">{data.tanggal}</p>
              </div>
              <div>
                <p className="text-cyan-500/70 text-xs font-bold uppercase tracking-wider mb-1">Waktu</p>
                <p className="font-medium text-slate-200 text-sm md:text-base">{data.waktu_mulai || '-'} s/d {data.waktu_selesai || '-'}</p>
              </div>
              <div>
                <p className="text-cyan-500/70 text-xs font-bold uppercase tracking-wider mb-1">Tempat</p>
                <p className="font-medium text-slate-200 text-sm md:text-base">{data.tempat}</p>
              </div>
              <div>
                <p className="text-cyan-500/70 text-xs font-bold uppercase tracking-wider mb-1">Pimpinan Rapat</p>
                <p className="font-medium text-slate-200 text-sm md:text-base">{data.pimpinan_rapat}</p>
              </div>
            </div>
            {data.peserta && (
              <div className="mt-6 pt-6 border-t border-cyan-900/20">
                <p className="text-cyan-500/70 text-xs font-bold uppercase tracking-wider mb-2">Daftar Peserta</p>
                <p className="font-medium text-slate-300 text-sm leading-relaxed">{data.peserta}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl p-8 backdrop-blur-lg bg-[#040d2b]/80 border border-cyan-900/60 shadow-[0_0_20px_rgba(34,211,238,0.08)] space-y-8">
            
            {data.agenda && (
              <div>
                <h3 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span> Agenda Rapat
                </h3>
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base bg-[#0a1536] p-5 rounded-lg border border-cyan-900/30">
                  {data.agenda}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span> Pembahasan Utama
              </h3>
              <div className="text-slate-200 whitespace-pre-wrap leading-loose text-sm md:text-base bg-[#0a1536] p-5 rounded-lg border border-cyan-900/30">
                {data.isi_notulen}
              </div>
            </div>
            
            {data.kesimpulan && (
              <div>
                <h3 className="text-green-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span> Kesimpulan
                </h3>
                <div className="text-slate-200 whitespace-pre-wrap leading-relaxed text-sm md:text-base bg-green-900/10 p-5 rounded-lg border border-green-500/20">
                  {data.kesimpulan}
                </div>
              </div>
            )}
            
            {data.tindak_lanjut && (
              <div>
                <h3 className="text-orange-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span> Rencana Tindak Lanjut
                </h3>
                <div className="text-slate-200 whitespace-pre-wrap leading-relaxed text-sm md:text-base bg-orange-900/10 p-5 rounded-lg border border-orange-500/20 font-mono">
                  {data.tindak_lanjut}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
