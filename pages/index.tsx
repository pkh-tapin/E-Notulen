import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
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
  peserta: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [notulen, setNotulen] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [stats, setStats] = useState({ total: 0, final: 0, draft: 0, thisMonth: 0 });

  // ================= STATE KEAMANAN ADMIN =================
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Cek sesi login admin saat pertama kali web dibuka
  useEffect(() => {
    const adminSession = localStorage.getItem('notulen_admin_logged');
    if (adminSession === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // ⚠️ GANTI 'admin123' DENGAN PASSWORD RAHASIA YANG KAMU INGINKAN
    if (password === 'admin123') {
      setIsAdmin(true);
      localStorage.setItem('notulen_admin_logged', 'true');
      setShowLogin(false);
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('Akses Ditolak! Kata sandi salah.');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('notulen_admin_logged');
  };
  // ========================================================

  const fetchData = useCallback(async () => {
    try {
      const url = filterDate ? `/api/notulen?tanggal=${filterDate}` : '/api/notulen';
      const res = await fetch(url);
      const data = await res.json();
      setNotulen(Array.isArray(data) ? data : []);

      const all = Array.isArray(data) ? data : [];
      const thisMonth = new Date().toISOString().slice(0, 7);
      setStats({
        total: all.length,
        final: all.filter((n: Notulen) => n.status === 'final').length,
        draft: all.filter((n: Notulen) => n.status === 'draft').length,
        thisMonth: all.filter((n: Notulen) => n.created_at?.startsWith(thisMonth)).length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = notulen.filter(n => {
    const q = search.toLowerCase();
    const matchSearch = !q || n.judul?.toLowerCase().includes(q) ||
      n.tempat?.toLowerCase().includes(q) || n.pimpinan_rapat?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || n.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'dd MMM yyyy', { locale: idLocale }); }
    catch { return d; }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'badge-draft', final: 'badge-final', review: 'badge-review'
    };
    return map[status] || 'badge-draft';
  };

  const statusLabel: Record<string, string> = {
    draft: 'Draft', final: 'Final', review: 'Review'
  };

  return (
    <>
      <Head>
        <title>NotulenAI — Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

          body {
            background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%);
            background-attachment: fixed;
            font-family: 'Inter', sans-serif;
            color: #f3f4f6;
            margin: 0;
          }

          .glass-panel {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          }

          .glass-card {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
          }
          .glass-card:hover {
            transform: translateY(-5px);
            background: rgba(0, 0, 0, 0.3);
            border-color: rgba(167, 139, 250, 0.3);
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.2);
          }

          .glass-input {
            background: rgba(0, 0, 0, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: #e5e7eb !important;
            transition: all 0.3s ease;
          }
          .glass-input:focus {
            border-color: #a78bfa !important;
            box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.2) !important;
            outline: none;
          }

          .btn-glossy {
            background: linear-gradient(135deg, #c084fc, #7e22ce);
            border: none;
            box-shadow: 0 4px 15px rgba(126, 34, 206, 0.4), inset 0 2px 0 rgba(255,255,255,0.2);
            color: white;
            transition: all 0.3s ease;
          }
          .btn-glossy:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(126, 34, 206, 0.6), inset 0 2px 0 rgba(255,255,255,0.2);
          }

          .badge-draft { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
          .badge-review { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
          .badge-final { background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }

          /* Style Modal Login */
          .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px);
            z-index: 100; display: flex; align-items: center; justify-content: center;
          }

          /* Custom Scrollbar */
          ::-webkit-scrollbar { height: 8px; width: 8px; }
          ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
          ::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.5); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.8); }
        `}</style>
      </Head>

      <div className="min-h-screen">
        {/* Navbar */}
        <nav className="glass-panel sticky top-0 z-50 rounded-none border-t-0 border-l-0 border-r-0">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #c084fc, #7e22ce)' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-fuchsia-300 hidden sm:block">
                NOTULEN<span className="text-white">AI</span>
              </span>
              
              {/* LENCANA MODE (PUBLIC / ADMIN) */}
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${isAdmin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                {isAdmin ? '🛡️ Admin Mode' : '👁️ Public View'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-purple-300 text-sm font-medium hidden md:block">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>

              {/* TOMBOL LOGIN / LOGOUT ADMIN */}
              <button
                onClick={isAdmin ? handleLogout : () => setShowLogin(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition duration-300 ${
                  isAdmin 
                    ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                    : 'bg-white/5 text-purple-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {isAdmin ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Logout
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Admin
                  </>
                )}
              </button>

              {/* TOMBOL TAMBAH NOTULEN (HANYA MUNCUL BILA ADMIN LOGIN) */}
              {isAdmin && (
                <Link href="/tambah">
                  <button className="btn-glossy flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:block">Tambah Notulen</span>
                    <span className="sm:hidden">Tambah</span>
                  </button>
                </Link>
              )}
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              DASHBOARD <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">NOTULEN</span>
            </h1>
            <p className="text-purple-300 text-sm md:text-base">Sistem manajemen notulen rapat cerdas berbasis AI</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
            {[
              { label: 'Total Notulen', value: stats.total, icon: '📋', color: '#c084fc' },
              { label: 'Notulen Final', value: stats.final, icon: '✅', color: '#34d399' },
              { label: 'Masih Draft', value: stats.draft, icon: '📝', color: '#fbbf24' },
              { label: 'Bulan Ini', value: stats.thisMonth, icon: '📅', color: '#38bdf8' },
            ].map((s, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-2xl bg-white/10 w-10 h-10 flex items-center justify-center rounded-xl border border-white/5 shadow-inner">{s.icon}</div>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
                </div>
                <div className="text-4xl font-bold mb-1" style={{ color: s.color, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{s.value}</div>
                <div className="text-purple-200/70 text-xs font-semibold uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table Container */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            {/* Search & Filter Bar */}
            <div className="p-5 border-b border-white/10 bg-black/20 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-2 h-6 bg-gradient-to-b from-purple-400 to-fuchsia-600 rounded-full"></div>
                <span className="text-lg font-bold tracking-wide text-white">DAFTAR NOTULEN</span>
                <span className="bg-purple-900/50 text-purple-300 px-3 py-1 rounded-full text-xs font-bold border border-purple-500/30 ml-2">
                  {filtered.length} Data
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-64 group">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 group-focus-within:text-purple-300 transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari notulen..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-2 rounded-xl text-sm"
                  />
                </div>
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="glass-input px-3 py-2 rounded-xl text-sm [color-scheme:dark]"
                />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="glass-input px-3 py-2 rounded-xl text-sm cursor-pointer"
                >
                  <option value="" style={{ color: 'black' }}>Semua Status</option>
                  <option value="draft" style={{ color: 'black' }}>Draft</option>
                  <option value="review" style={{ color: 'black' }}>Review</option>
                  <option value="final" style={{ color: 'black' }}>Final</option>
                </select>
                {filterDate && (
                  <button onClick={() => setFilterDate('')} className="px-4 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-900/30 border border-red-500/30 hover:bg-red-900/50 transition">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Table Content */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-purple-300 font-medium">Memuat Database AI...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="text-5xl mb-4 opacity-50">📭</div>
                  <p className="text-purple-300 text-lg mb-2">Belum ada notulen yang ditemukan</p>
                  {isAdmin && (
                    <Link href="/tambah">
                      <span className="text-fuchsia-400 text-sm font-semibold cursor-pointer hover:text-fuchsia-300 hover:underline">Tambah notulen baru sekarang →</span>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-black/20 text-purple-300 text-xs uppercase tracking-wider font-semibold border-b border-white/10">
                      <th className="px-6 py-4">No</th>
                      <th className="px-6 py-4">Judul Rapat</th>
                      <th className="px-6 py-4 hidden md:table-cell">Tanggal</th>
                      <th className="px-6 py-4 hidden lg:table-cell">Tempat</th>
                      <th className="px-6 py-4 hidden lg:table-cell">Pimpinan</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n, i) => (
                      <tr key={n.id} className="border-b border-white/5 hover:bg-white/5 transition duration-200">
                        <td className="px-6 py-4 text-purple-400 font-bold">{i + 1}</td>
                        <td className="px-6 py-4">
                          <div className="text-white font-semibold text-base mb-1">{n.judul}</div>
                          <div className="text-purple-300/60 text-xs font-mono">{n.id}</div>
                        </td>
                        <td className="px-6 py-4 text-purple-200 hidden md:table-cell">
                          {n.tanggal ? formatDate(n.tanggal) : '-'}
                        </td>
                        <td className="px-6 py-4 text-purple-200 hidden lg:table-cell">{n.tempat || '-'}</td>
                        <td className="px-6 py-4 text-purple-200 hidden lg:table-cell">{n.pimpinan_rapat || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${statusBadge(n.status)}`}>
                            {statusLabel[n.status] || n.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* TOMBOL LIHAT (SELALU MUNCUL UNTUK PUBLIK & ADMIN) */}
                            <Link href={`/notulen/${n.id}`}>
                              <button className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/20 transition" title="Lihat">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </Link>

                            {/* TOMBOL EDIT (HANYA MUNCUL JIKA ADMIN LOGIN) */}
                            {isAdmin && (
                              <Link href={`/tambah?edit=${n.id}`}>
                                <button className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 border border-yellow-500/20 transition" title="Edit">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </Link>
                            )}

                            {/* TOMBOL CETAK (SELALU MUNCUL UNTUK PUBLIK & ADMIN) */}
                            <Link href={`/cetak/${n.id}`} target="_blank">
                              <button className="p-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border border-fuchsia-500/20 transition" title="Cetak">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                              </button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* POPUP MODAL LOGIN ADMIN GLASSMORPHISM (MUNCUL BILA KLIK LOGIN) */}
      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div 
            className="glass-panel p-8 rounded-2xl w-full max-w-sm mx-4 transform transition-all duration-300 scale-100 opacity-100 shadow-[0_0_50px_rgba(139,92,246,0.3)] border-t border-l border-white/20" 
            onClick={(e) => e.stopPropagation()} // Mencegah klik di dalam modal menutup modal
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3 hover:rotate-0 transition-transform">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white tracking-wide">Otorisasi Admin</h3>
              <p className="text-xs text-purple-200/60 mt-1 font-medium">Buka kunci fitur tambah & edit data</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="relative group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 group-focus-within:text-purple-300"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                <input
                  type="password"
                  placeholder="Ketik kata sandi..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full pl-11 pr-4 py-3 rounded-xl text-sm tracking-widest focus:ring-2 focus:ring-purple-500/50"
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold p-2.5 rounded-lg text-center animate-pulse">
                  {loginError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowLogin(false); setLoginError(''); setPassword(''); }}
                  className="w-1/2 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-sm font-bold btn-glossy transition flex items-center justify-center gap-2"
                >
                  Masuk
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
