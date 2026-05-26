import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface Notulen {
  id: string;
  judul: string;
  tanggal: string;
  tempat: string;
  pimpinan_rapat: string;
  status: string;
}

export default function DashboardAwal() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [data, setData] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fitur Otorisasi Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Fitur Interaksi Data
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Fitur Pencarian & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Fitur Paginasi
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // ==========================================
  // FETCH DATA (TERBUKA UNTUK PUBLIK)
  // ==========================================
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notulen');
      const result = await res.json();
      if (!result.error && Array.isArray(result)) {
        const sortedData = result.sort((a: any, b: any) => {
          return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
        });
        setData(sortedData);
      }
    } catch (err) {
      console.error("Gagal mengambil data", err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOGIKA PENCARIAN & FILTER CANGGIH
  // ==========================================
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = (item.judul?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (item.pimpinan_rapat?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, searchTerm, statusFilter]);

  // Logika Paginasi
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1); // Reset halaman jika filter berubah
  }, [searchTerm, statusFilter]);

  // ==========================================
  // LOGIKA ADMIN & MODAL PIN
  // ==========================================
  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false); // Logout langsung
    } else {
      setShowPinModal(true); // Tampilkan modal login
      setPinInput('');
      setPinError('');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') { // PIN DEFAULT ADMIN
      setIsAdmin(true);
      setShowPinModal(false);
    } else {
      setPinError('PIN yang Anda masukkan salah!');
      setPinInput('');
    }
  };

  // ==========================================
  // LOGIKA HAPUS DATA
  // ==========================================
  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notulen?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setData(data.filter(item => item.id !== deleteId));
        setDeleteId(null);
      } else {
        alert("Gagal menghapus data di server.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ==========================================
  // STATISTIK DASHBOARD
  // ==========================================
  const statTotal = data.length;
  const statFinal = data.filter(d => d.status === 'final').length;
  const statDraft = data.filter(d => d.status === 'draft' || d.status === 'review').length;

  return (
    <>
      <Head>
        <title>Dashboard - Arsip Notulen Digital</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&display=swap');
          body {
            background: linear-gradient(135deg, #020818 0%, #0a1536 100%);
            font-family: 'Exo 2', sans-serif;
            overflow-x: hidden;
          }
          /* Custom Scrollbar */
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: #020818; }
          ::-webkit-scrollbar-thumb { background: #22d3ee40; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #22d3ee; }
        `}</style>
      </Head>

      <div className="min-h-screen text-slate-200 w-full relative">
        
        {/* ========================================== */}
        {/* MODAL PIN ADMIN (GLASSMORPHISM) */}
        {/* ========================================== */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-[#020818]/80 transition-all">
            <div className="bg-[#040d2b] border border-cyan-500/30 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(34,211,238,0.15)] animate-fade-up">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-cyan-300">Otorisasi Admin</h3>
                <button onClick={() => setShowPinModal(false)} className="text-slate-500 hover:text-red-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <form onSubmit={handlePinSubmit}>
                <div className="mb-4">
                  <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2">Masukkan PIN</label>
                  <input 
                    type="password" 
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-3 rounded-lg bg-[#0a1536] border border-cyan-900/50 text-white focus:border-cyan-400 outline-none transition-colors text-center text-2xl tracking-widest font-mono"
                    placeholder="••••"
                  />
                  {pinError && <p className="text-red-400 text-xs mt-2">{pinError}</p>}
                </div>
                <button type="submit" className="w-full py-3 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all font-semibold">
                  Buka Kunci Akses
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL KONFIRMASI HAPUS */}
        {/* ========================================== */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-[#020818]/80">
            <div className="bg-[#040d2b] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-fade-up">
              <h3 className="text-xl font-bold text-red-400 mb-2">Hapus Dokumen?</h3>
              <p className="text-slate-400 text-sm mb-6">Tindakan ini tidak dapat dibatalkan. Dokumen akan dihapus permanen dari database.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm">Batal</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2.5 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-all text-sm font-semibold">
                  {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* NAVBAR */}
        {/* ========================================== */}
        <nav className="border-b border-cyan-500/20 sticky top-0 z-40 backdrop-blur-xl bg-[#040d2b]/90 w-full shadow-lg">
          <div className="w-full max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400 font-bold">N</div>
              <h1 className="text-cyan-400 font-bold tracking-widest text-lg hidden md:block">
                ARSIP<span className="text-white">NOTULEN</span>
              </h1>
            </div>
            
            <div className="flex gap-3 md:gap-4 items-center">
              {/* TOMBOL GEMBOK ADMIN */}
              <button 
                onClick={handleAdminToggle} 
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border ${isAdmin ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.4)]' : 'bg-transparent border-transparent text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/20'}`}
                title={isAdmin ? "Tutup Akses Admin" : "Buka Akses Admin"}
              >
                {isAdmin ? (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg><span className="text-xs font-bold hidden md:inline">ADMIN AKTIF</span></>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                )}
              </button>

              {isAdmin && (
                <Link href="/tambah" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-white font-semibold text-xs md:text-sm hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-2">
                  <span>+</span> <span className="hidden md:inline">Tambah Notulen</span>
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* ========================================== */}
        {/* HERO SECTION & STATISTIK */}
        {/* ========================================== */}
        <div className="w-full max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl p-6 bg-gradient-to-br from-[#040d2b] to-[#0a1536] border border-cyan-900/50 shadow-lg relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl"></div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Total Arsip</p>
              <h2 className="text-4xl font-bold text-white">{statTotal} <span className="text-sm font-normal text-slate-500">dokumen</span></h2>
            </div>
            <div className="rounded-xl p-6 bg-gradient-to-br from-[#040d2b] to-[#0a1536] border border-green-900/30 shadow-lg relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-xl"></div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Telah Finalisasi</p>
              <h2 className="text-4xl font-bold text-green-400">{statFinal} <span className="text-sm font-normal text-slate-500">selesai</span></h2>
            </div>
            <div className="rounded-xl p-6 bg-gradient-to-br from-[#040d2b] to-[#0a1536] border border-orange-900/30 shadow-lg relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-xl"></div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Draft / Review</p>
              <h2 className="text-4xl font-bold text-orange-400">{statDraft} <span className="text-sm font-normal text-slate-500">tertunda</span></h2>
            </div>
          </div>

          {/* ========================================== */}
          {/* KONTROL PENCARIAN & FILTER */}
          {/* ========================================== */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 bg-[#040d2b]/40 p-4 rounded-xl border border-cyan-900/30 backdrop-blur-md">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Cari berdasarkan judul atau pimpinan rapat..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#0a1536] border border-cyan-900/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
              />
            </div>
            <div className="w-full md:w-64">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a1536] border border-cyan-900/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors text-sm appearance-none"
              >
                <option value="all">Semua Status</option>
                <option value="final">✅ Finalisasi</option>
                <option value="review">👁️ Menunggu Review</option>
                <option value="draft">📝 Draft</option>
              </select>
            </div>
          </div>

          {/* ========================================== */}
          {/* GRID KONTEN UTAMA */}
          {/* ========================================== */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="rounded-xl p-6 bg-[#040d2b]/40 border border-slate-800 animate-pulse h-48">
                  <div className="w-1/3 h-4 bg-slate-800 rounded mb-4"></div>
                  <div className="w-full h-6 bg-slate-700 rounded mb-2"></div>
                  <div className="w-3/4 h-6 bg-slate-700 rounded mb-6"></div>
                  <div className="w-1/2 h-4 bg-slate-800 rounded"></div>
                </div>
              ))}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-[#040d2b]/30 rounded-2xl border border-dashed border-cyan-900/50">
              <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <h3 className="text-xl font-semibold text-slate-400">Tidak Ada Data</h3>
              <p className="text-slate-500 mt-2 text-sm">Sesuaikan filter pencarian atau tambahkan dokumen baru.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {paginatedData.map((item) => (
                  <div key={item.id} className="group flex flex-col justify-between rounded-xl p-6 bg-gradient-to-b from-[#040d2b]/80 to-[#020818] border border-cyan-900/40 hover:border-cyan-400/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.1)] relative overflow-hidden">
                    
                    {/* Efek Hover Garis Atas */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <Link href={`/notulen/${item.id}`} className="block flex-grow cursor-pointer z-10">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-mono px-2.5 py-1 bg-[#0a1536] text-cyan-400 rounded-md border border-cyan-900/50">
                          {item.tanggal || 'Tanpa Tanggal'}
                        </span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border ${item.status === 'final' ? 'bg-green-500/10 text-green-400 border-green-500/30' : item.status === 'review' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-slate-800 text-slate-400 border-slate-600'}`}>
                          {item.status || 'DRAFT'}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-white mb-3 leading-tight line-clamp-2 group-hover:text-cyan-300 transition-colors">
                        {item.judul || 'Dokumen Tanpa Judul'}
                      </h3>
                      
                      <div className="space-y-2 mt-auto">
                        <p className="text-sm text-slate-400 flex items-center gap-2 line-clamp-1">
                          <svg className="w-4 h-4 text-cyan-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          {item.tempat || 'Lokasi tidak diatur'}
                        </p>
                        <p className="text-sm text-slate-400 flex items-center gap-2 line-clamp-1">
                          <svg className="w-4 h-4 text-cyan-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          {item.pimpinan_rapat || 'Anonim'}
                        </p>
                      </div>
                    </Link>

                    {/* KONTROL ADMIN (Tampil Hanya Jika Gembok Terbuka) */}
                    <div className={`mt-5 pt-4 border-t border-cyan-900/30 flex gap-3 justify-end transition-all duration-300 overflow-hidden ${isAdmin ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 border-transparent pb-0 mt-0 pt-0'}`}>
                      <Link href={`/tambah?edit=${item.id}`} className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-all z-20 flex-1 text-center">
                        Edit Data
                      </Link>
                      <button onClick={() => setDeleteId(item.id)} className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all z-20 flex-1">
                        Hapus
                      </button>
                    </div>

                  </div>
                ))}
              </div>

              {/* ========================================== */}
              {/* PAGINASI BAWAH */}
              {/* ========================================== */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 border-t border-cyan-900/30 pt-8 pb-10">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="p-2 rounded-lg bg-[#040d2b] border border-cyan-900/50 text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyan-900/30 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'bg-cyan-500 text-slate-900 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-[#040d2b] border border-cyan-900/50 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50'}`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="p-2 rounded-lg bg-[#040d2b] border border-cyan-900/50 text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyan-900/30 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
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
