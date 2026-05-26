import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// =========================================================================
// INTERFACES & DATA STRUCT (Sesuai Blueprint Database Google Sheets Anda)
// =========================================================================
interface Notulen {
  id: string;
  judul: string;
  tanggal: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  tempat: string;
  pimpinan_rapat: string;
  notulis?: string;
  peserta?: string;
  agenda?: string;
  isi_notulen: string;
  kesimpulan?: string;
  tindak_lanjut?: string;
  status: string;
}

export default function DashboardPremium() {
  // =========================================================================
  // STATE MANAGEMENT SYSTEMS
  // =========================================================================
  const [data, setData] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sistem Otorisasi Akses Gembok Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Sistem Manajemen Proteksi Penghapusan Data
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Sistem Filter, Pencarian Makro, & Navigasi Paginasi
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Optimal untuk tampilan grid mobile & desktop fit screen

  // State Pelacak Cetak PDF per Item
  const [printingId, setPrintingId] = useState<string | null>(null);

  // =========================================================================
  // ENGINE AMBIL DATA SINKRON (REALTIME DRIVEN)
  // =========================================================================
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notulen');
      const result = await res.json();
      if (!result.error && Array.isArray(result)) {
        // Pengurutan otomatis berdasarkan tanggal terbaru (Kronologis)
        const sortedData = result.sort((a: any, b: any) => {
          return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
        });
        setData(sortedData);
      }
    } catch (err) {
      console.error("Gagal sinkronisasi database sheets:", err);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // LOGIKA FILTERING & PENCARIAN CERDAS
  // =========================================================================
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = (item.judul?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (item.pimpinan_rapat?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (item.tempat?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, searchTerm, statusFilter]);

  // Kalkulasi Pembagian Halaman Paginasi
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // =========================================================================
  // MANAJEMEN AUTENTIKASI MODAL PIN GEMBOK
  // =========================================================================
  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false); 
    } else {
      setShowPinModal(true);
      setPinInput('');
      setPinError('');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') { // PIN COCOK
      setIsAdmin(true);
      setShowPinModal(false);
    } else {
      setPinError('PIN Otorisasi Salah, Akses Ditolak!');
      setPinInput('');
    }
  };

  // =========================================================================
  // LOGIKA EKSEKUSI PENGHAPUSAN AMAN
  // =========================================================================
  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notulen?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setData(data.filter(item => item.id !== deleteId));
        setDeleteId(null);
      } else {
        alert("Gagal menghapus entri data dari server.");
      }
    } catch (err) {
      console.error(err);
      alert("Masalah koneksi internet/jaringan gagal.");
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // MESIN CETAK PDF PREMIUM (FORMAL INDONESIAN OFFICIAL DOCUMENT TEMPLATE)
  // =========================================================================
  const handleCetakPDF = (item: Notulen) => {
    setPrintingId(item.id);

    // Skrip Struktur HTML untuk menghasilkan cetakan resmi instansi
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '-9999px';
    printContainer.innerHTML = `
      <div id="print-capture-area" style="padding: 20mm 15mm; font-family: 'Arial', sans-serif; color: #000; background: #fff; line-height: 1.6; font-size: 12pt;">
        <div style="text-align: center; border-b: 3px double #000; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; uppercase; font-size: 16pt; tracking-wide: 1px;">NOTULEN RAPAT</h2>
          <p style="margin: 5px 0 0 0; font-size: 10pt; color: #333;">Sistem Dokumentasi & Arsip Digital Otomatis</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11pt;">
          <tr>
            <td style="width: 25%; font-weight: bold; padding: 5px 0; vertical-align: top;">Hari / Tanggal</td>
            <td style="width: 3%; vertical-align: top;">:</td>
            <td style="padding: 5px 0; vertical-align: top;">${item.tanggal || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 5px 0; vertical-align: top;">Waktu Pelaksanaan</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 5px 0; vertical-align: top;">${item.waktu_mulai || '-'} s/d ${item.waktu_selesai || 'Selesai'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 5px 0; vertical-align: top;">Tempat Rapat</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 5px 0; vertical-align: top;">${item.tempat || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 5px 0; vertical-align: top;">Pimpinan Rapat</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 5px 0; vertical-align: top;">${item.pimpinan_rapat || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 5px 0; vertical-align: top;">Notulis / Pencatat</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 5px 0; vertical-align: top;">${item.notulis || '-'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 5px 0; vertical-align: top;">Daftar Peserta</td>
            <td style="vertical-align: top;">:</td>
            <td style="padding: 5px 0; vertical-align: top; white-space: pre-wrap;">${item.peserta || '-'}</td>
          </tr>
        </table>

        <div style="margin-bottom: 20px;">
          <h3 style="border-bottom: 1px solid #000; padding-bottom: 3px; font-size: 12pt; uppercase; margin-bottom: 8px;">I. AGENDA RAPAT</h3>
          <p style="margin: 0; padding-left: 15px; white-space: pre-wrap;">${item.agenda || 'Pembahasan internal.'}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="border-bottom: 1px solid #000; padding-bottom: 3px; font-size: 12pt; uppercase; margin-bottom: 8px;">II. PEMBAHASAN UTAMA</h3>
          <div style="margin: 0; padding-left: 15px; white-space: pre-wrap; text-align: justify;">${item.isi_notulen}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="border-bottom: 1px solid #000; padding-bottom: 3px; font-size: 12pt; uppercase; margin-bottom: 8px;">III. KESIMPULAN RAPAT</h3>
          <p style="margin: 0; padding-left: 15px; white-space: pre-wrap; text-align: justify;">${item.kesimpulan || '-'}</p>
        </div>

        <div style="margin-bottom: 35px;">
          <h3 style="border-bottom: 1px solid #000; padding-bottom: 3px; font-size: 12pt; uppercase; margin-bottom: 8px;">IV. RENCANA TINDAK LANJUT (RTL)</h3>
          <p style="margin: 0; padding-left: 15px; font-family: monospace; white-space: pre-wrap;">${item.tindak_lanjut || '-'}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 50px; font-size: 11pt;">
          <tr>
            <td style="width: 50%; text-align: center; padding-bottom: 60px;">Pimpinan Rapat,</td>
            <td style="width: 50%; text-align: center; padding-bottom: 60px;">Notulis Rapat,</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold; text-decoration: underline;">( ${item.pimpinan_rapat || '........................'} )</td>
            <td style="text-align: center; font-weight: bold; text-decoration: underline;">( ${item.notulis || '........................'} )</td>
          </tr>
        </table>
      </div>
    `;

    document.body.appendChild(printContainer);

    const opt = {
      margin:       0,
      filename:     `NOTULEN_${item.tanggal || 'RAPAT'}_${item.id.substring(0,5)}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const runHtml2Pdf = () => {
      (window as any).html2pdf().set(opt).from(document.getElementById('print-capture-area')).save().then(() => {
        setPrintingId(null);
        document.body.removeChild(printContainer);
      }).catch((err: any) => {
        console.error(err);
        alert("Eror cetak dokumen!");
        setPrintingId(null);
        document.body.removeChild(printContainer);
      });
    };

    // Auto load CDN engine tanpa merusak project
    if (!(window as any).html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runHtml2Pdf;
      document.head.appendChild(script);
    } else {
      runHtml2Pdf();
    }
  };

  // Kalkulasi Dashboard Berdasarkan Data Aktual
  const hitungTotal = data.length;
  const hitungFinal = data.filter(d => d.status === 'final').length;
  const hitungDraft = data.filter(d => d.status === 'draft' || d.status === 'review').length;

  return (
    <>
      <Head>
        <title>Arsip Notulen Digital Premium</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&display=swap');
          body {
            background: linear-gradient(135deg, #020818 0%, #0a1536 100%);
            font-family: 'Exo 2', sans-serif;
            overflow-x: hidden;
          }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #020818; }
          ::-webkit-scrollbar-thumb { background: #22d3ee30; border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: #22d3ee; }
        `}</style>
      </Head>

      <div className="min-h-screen text-slate-200 w-full relative overflow-x-hidden">
        
        {/* ========================================================================= */}
        {/* MODAL INTEGRASI PIN ADMIN (GLASSMORPHISM LUXURY) */}
        {/* ========================================================================= */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-[#020818]/80 transition-all">
            <div className="bg-[#040d2b]/90 border border-cyan-500/40 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_40px_rgba(34,211,238,0.2)]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-cyan-300 tracking-wider">Akses Kunci Admin</h3>
                <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-red-400 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <form onSubmit={handlePinSubmit}>
                <div className="mb-5">
                  <label className="block text-slate-400 text-xs uppercase tracking-widest mb-2">PIN SISTEM</label>
                  <input 
                    type="password" 
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-[#0a1536] border border-cyan-900 text-white focus:border-cyan-400 outline-none text-center text-2xl tracking-widest font-mono transition-all"
                    placeholder="••••"
                  />
                  {pinError && <p className="text-red-400 text-xs mt-2 text-center font-medium">{pinError}</p>}
                </div>
                <button type="submit" className="w-full py-3 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 rounded-xl hover:bg-cyan-500/40 transition-all text-sm font-bold tracking-widest">
                  BUKA OTORISASI
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL KONFIRMASI HAPUS DATA ANTI KELALAIAN */}
        {/* ========================================================================= */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-[#020818]/90">
            <div className="bg-[#040d2b] border border-red-500/40 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h3 className="text-lg font-bold text-red-400 mb-2 uppercase tracking-wide">Hapus Permanen?</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">Tindakan ini akan menghapus data di Google Sheet secara permanen. File tidak bisa dipulihkan.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors text-xs font-semibold">Batal</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2.5 bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/30 transition-all text-xs font-bold">
                  {isDeleting ? 'Memproses...' : 'Ya, Bersihkan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TOP COMPACT FIXED NAVIGATION BAR */}
        {/* ========================================================================= */}
        <nav className="border-b border-cyan-500/10 sticky top-0 z-40 backdrop-blur-xl bg-[#040d2b]/80 w-full shadow-md">
          <div className="w-full max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-[0_0_10px_rgba(34,211,238,0.4)]">N</div>
              <h1 className="text-cyan-400 font-bold tracking-widest text-sm uppercase">
                Maju<span className="text-white">Arsip</span>
              </h1>
            </div>
            
            <div className="flex gap-2 items-center">

              {/* [PERBAIKAN] TOMBOL TAMBAH UNTUK SEMUA ORANG (NON-ADMIN TETAP BISA AKSES) */}
              <Link href="/tambah" className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-white font-bold text-xs uppercase tracking-wider hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg flex items-center gap-1">
                <span>+ Add Data</span>
              </Link>

              {/* TOMBOL GEMBOK ADMIN LOCK LOGIC */}
              <button 
                onClick={handleAdminToggle} 
                className={`flex items-center justify-center p-2 rounded-lg transition-all border ${isAdmin ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-transparent border-transparent text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/20'}`}
                title={isAdmin ? "Kunci Admin" : "Buka Fitur Manajemen (Admin)"}
              >
                {isAdmin ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* MONITORING PANEL KARTU METRIK STATISTIK */}
        {/* ========================================================================= */}
        <div className="w-full max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
            <div className="rounded-xl p-4 bg-gradient-to-b from-[#040d2b] to-[#020818] border border-cyan-900/30 shadow relative">
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Total</p>
              <h2 className="text-2xl font-bold text-white font-mono">{hitungTotal}</h2>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-b from-[#040d2b] to-[#020818] border border-green-900/20 shadow relative">
              <p className="text-green-500/70 text-[10px] uppercase font-bold tracking-wider mb-1">Final</p>
              <h2 className="text-2xl font-bold text-green-400 font-mono">{hitungFinal}</h2>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-b from-[#040d2b] to-[#020818] border border-orange-900/20 shadow relative">
              <p className="text-orange-500/70 text-[10px] uppercase font-bold tracking-wider mb-1">Draft</p>
              <h2 className="text-2xl font-bold text-orange-400 font-mono">{hitungDraft}</h2>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEARCH DAN FILTER INPUT - DESIGN FIT TO SCREEN */}
          {/* ========================================================================= */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6 bg-[#040d2b]/30 p-3 rounded-xl border border-cyan-900/20 backdrop-blur-md">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Cari judul / pimpinan..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#0a1536] border border-cyan-900/40 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors text-xs"
              />
            </div>
            <div className="w-full sm:w-44">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0a1536] border border-cyan-900/40 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 text-xs appearance-none cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="final">✅ Finalisasi</option>
                <option value="review">👁️ Review</option>
                <option value="draft">📝 Draft</option>
              </select>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LAYOUT GRID DENGAN SISTEM FIT-SCREEN MOBILE-FIRST */}
          {/* ========================================================================= */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(n => (
                <div key={n} className="rounded-xl p-5 bg-[#040d2b]/20 border border-slate-800/40 animate-pulse h-40">
                  <div className="w-1/4 h-3 bg-slate-800 rounded mb-3"></div>
                  <div className="w-full h-5 bg-slate-700 rounded mb-2"></div>
                  <div className="w-2/3 h-5 bg-slate-700 rounded mb-4"></div>
                </div>
              ))}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-[#040d2b]/10 rounded-xl border border-dashed border-cyan-900/30">
              <p className="text-slate-500 text-xs font-mono">Arsip data kosong atau tidak ditemukan.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {paginatedData.map((item) => (
                  <div key={item.id} className="group relative flex flex-col justify-between rounded-xl p-5 bg-gradient-to-b from-[#040d2b]/90 to-[#020818] border border-cyan-900/30 hover:border-cyan-500/40 transition-all duration-300 shadow-md">
                    
                    <div>
                      {/* Badge tanggal dan status formal */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0a1536] text-cyan-400 rounded border border-cyan-900/60">
                          {item.tanggal || 'No Date'}
                        </span>
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${item.status === 'final' ? 'bg-green-500/10 text-green-400 border-green-500/20' : item.status === 'review' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {item.status || 'DRAFT'}
                        </span>
                      </div>
                      
                      {/* Judul Notulen */}
                      <h3 className="text-sm font-bold text-white mb-3 line-clamp-2 leading-snug group-hover:text-cyan-400 transition-colors">
                        {item.judul || 'Judul Kosong'}
                      </h3>
                      
                      {/* Sekilas Informasi Lokasi dan Pimpinan */}
                      <div className="space-y-1.5 mb-4">
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 line-clamp-1">
                          <span className="text-cyan-500 font-bold">📍</span> {item.tempat || '-'}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 line-clamp-1">
                          <span className="text-cyan-500 font-bold">👤</span> {item.pimpinan_rapat || '-'}
                        </p>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* HUB KONTROL TOMBOL: LIHAT, CETAK, EDIT (TIDAK BOLEH DIKURANGI) */}
                    {/* ========================================================================= */}
                    <div className="pt-3 border-t border-cyan-900/20 flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex gap-1.5 flex-1">
                        {/* 1. TOMBOL LIHAT (MENU UTAMA) */}
                        <Link href={`/notulen/${item.id}`} className="px-2.5 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-md text-cyan-400 text-[11px] font-bold tracking-wide hover:bg-cyan-500/20 transition-all text-center flex-1">
                          👁️ Lihat
                        </Link>
                        
                        {/* 2. TOMBOL CETAK PDF (INTEGRASI PENYEMPURNAAN) */}
                        <button 
                          onClick={() => handleCetakPDF(item)}
                          disabled={printingId === item.id}
                          className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-md text-blue-400 text-[11px] font-bold tracking-wide hover:bg-blue-500/20 transition-all text-center flex-1 disabled:opacity-40"
                        >
                          {printingId === item.id ? '⏳...' : '🖨️ Cetak'}
                        </button>
                      </div>

                      {/* 3. TOMBOL KONTROL ADMIN EDIT & HAPUS (MUNCUL OTOMATIS JIKA ADMIN AKTIF) */}
                      {isAdmin && (
                        <div className="w-full mt-2 flex gap-1.5 border-t border-dashed border-cyan-900/30 pt-2 animate-fade-in">
                          <Link href={`/tambah?edit=${item.id}`} className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-[10px] font-bold text-center flex-1 hover:bg-yellow-500/20 transition-all">
                            📝 Edit
                          </Link>
                          <button onClick={() => setDeleteId(item.id)} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[10px] font-bold text-center flex-1 hover:bg-red-500/20 transition-all">
                            🗑️ Hapus
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>

              {/* ========================================================================= */}
              {/* COMPACT MOBILE-FIRST PAGINATION PANEL */}
              {/* ========================================================================= */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-1.5 border-t border-cyan-900/20 pt-4 pb-6">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="p-1.5 rounded-md bg-[#040d2b] border border-cyan-900/60 text-cyan-400 disabled:opacity-20 transition-all"
                  >
                    ◀
                  </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 text-xs font-bold rounded transition-all ${currentPage === page ? 'bg-cyan-500 text-slate-900 font-black' : 'bg-[#040d2b] text-slate-400 border border-cyan-900/40'}`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="p-1.5 rounded-md bg-[#040d2b] border border-cyan-900/60 text-cyan-400 disabled:opacity-20 transition-all"
                  >
                    ▶
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
