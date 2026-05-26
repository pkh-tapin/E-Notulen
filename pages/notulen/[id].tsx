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

  const handleDownloadPDF = () => {
    // Logika unduh otomatis setelah selesai file pdf/doc dibuat
    alert("Proses generate dan download otomatis PDF/DOC dimulai...");
    // Integrasikan library PDF generator (seperti jspdf/html2canvas) di sini nantinya
  };

  if (loading) return <div className="min-h-screen bg-[#020818] text-cyan-300 flex items-center justify-center font-mono">Loading Data...</div>;
  if (!data) return <div className="min-h-screen bg-[#020818] text-red-500 flex items-center justify-center font-mono">⚠️ Data Tidak Ditemukan</div>;

  return (
    <>
      <Head>
        <title>{data?.judul || 'Detail'} - Arsip Digital</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body {
            background: linear-gradient(135deg, #090d16 0%, #111726 100%);
          }
        `}</style> 
      </Head>

      {/* Desain Fit to Screen & No Horizontal Scroll */}
      <div className="min-h-screen bg-[#020818] text-slate-200 w-full overflow-x-hidden font-sans pb-10">
        
        {/* Navbar Mewah Glassmorphism */}
        <nav className="border-b border-cyan-500/20 sticky top-0 z-40 backdrop-blur-xl bg-[#040d2b]/80 w-full">
          <div className="w-full max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors font-bold tracking-wider flex items-center gap-2 text-sm md:text-base">
              <span>&larr;</span> KEMBALI
            </Link>
            
            <div className="flex gap-4 items-center">
              {/* Login khusus menggunakan Gembok saja, setting hanya untuk admin */}
              <button onClick={() => setIsAdmin(!isAdmin)} className="text-slate-500 hover:text-cyan-400 transition-colors" title="Akses Admin">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              </button>
              
              {isAdmin && (
                <Link href={`/tambah?edit=${id}`} className="hidden md:block px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded text-cyan-400 text-sm hover:bg-cyan-500/30 transition-all">
                  Edit Data
                </Link>
              )}
              
              <button onClick={handleDownloadPDF} className="px-4 py-2 bg-cyan-500 border border-cyan-400 rounded text-slate-900 font-semibold text-sm hover:bg-cyan-400 transition-all shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                ⬇️ Download PDF
              </button>
            </div>
          </div>
        </nav>

        {/* Konten Utama */}
        <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
          
          {/* Header Informasi */}
          <div className="rounded-xl p-6 backdrop-blur-lg bg-[#040d2b]/60 border border-cyan-900/50 shadow-[0_0_15px_rgba(34,211,238,0.05)]">
            <h1 className="text-xl md:text-2xl font-bold text-cyan-300 mb-6 leading-snug">{data.judul}</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 border-t border-cyan-900/30 pt-6">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Tanggal</p>
                <p className="font-medium text-sm md:text-base">{data.tanggal}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Waktu</p>
                <p className="font-medium text-sm md:text-base">{data.waktu_mulai} - {data.waktu_selesai}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Tempat</p>
                <p className="font-medium text-sm md:text-base">{data.tempat}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Pimpinan Rapat</p>
                <p className="font-medium text-sm md:text-base">{data.pimpinan_rapat}</p>
              </div>
            </div>
          </div>

          {/* Isi Notulen AI */}
          <div className="rounded-xl p-6 backdrop-blur-lg bg-[#040d2b]/60 border border-cyan-900/50 shadow-[0_0_15px_rgba(34,211,238,0.05)]">
            <h2 className="text-base md:text-lg font-semibold text-cyan-300 tracking-wider mb-6 flex items-center gap-2">
              <span className="w-1 h-5 rounded bg-cyan-400 inline-block" /> HASIL NOTULEN
            </h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-slate-500 text-xs uppercase tracking-wider mb-3">Agenda & Pembahasan Lengkap</h3>
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base bg-[#0a1536] p-4 rounded-lg border border-cyan-900/30">
                  {data.isi_notulen}
                </div>
              </div>
              
              <div>
                <h3 className="text-slate-500 text-xs uppercase tracking-wider mb-3">Kesimpulan</h3>
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base bg-green-500/5 p-4 rounded-lg border border-green-500/20">
                  {data.kesimpulan}
                </div>
              </div>
              
              <div>
                <h3 className="text-slate-500 text-xs uppercase tracking-wider mb-3">Rencana Tindak Lanjut</h3>
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base bg-orange-500/5 p-4 rounded-lg border border-orange-500/20 font-mono">
                  {data.tindak_lanjut}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
