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
  // --- STATE OTENTIKASI ADMIN ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- STATE MANAGEMENT DATA ---
  const [notulen, setNotulen] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [stats, setStats] = useState({ total: 0, final: 0, draft: 0, thisMonth: 0 });

  // Cek sesi login saat halaman pertama kali dimuat
  useEffect(() => {
    const session = localStorage.getItem('admin_auth');
    if (session === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default kredensial sistem admin cerdas
    if (username.toLowerCase() === 'admin' && password === 'admin123') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Kredensial salah! Silakan periksa kembali.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_auth');
  };

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const url = filterDate ? `/api/notulen?tanggal=${filterDate}` : '/api/notulen';
      const res = await fetch(url);
      const data = await res.json();
      setNotulen(Array.isArray(data) ? data : []);

      const all = Array.isArray(data) ? data : [];
      const currentMonth = new Date().toISOString().slice(0, 7);
      setStats({
        total: all.length,
        final: all.filter((n: Notulen) => n.status === 'final').length,
        draft: all.filter((n: Notulen) => n.status === 'draft').length,
        thisMonth: all.filter((n: Notulen) => n.created_at?.startsWith(currentMonth)).length,
      });
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterDate, isAuthenticated]);

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

  // --- SCREEN INTERFACE: GATEWAY LOGIN ADMIN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)' }}>
        <Head>
          <title>Secure Login — NotulenAI Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        </Head>
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-600/20 rounded-full filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-600/20 rounded-full filter blur-[100px] animate-pulse"></div>

        <div className="relative z-10 w-full max-w-md p-8 rounded-3xl backdrop-blur-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)' }}>
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #c084fc, #7e22ce)' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-fuchsia-200 tracking-wider">SYSTEM SECURE ACCESS</h2>
            <p className="text-purple-300/60 text-xs mt-1">Masukkan otentikasi administrator untuk masuk ke Dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-purple-200 text-xs font-semibold mb-2 uppercase tracking-widest">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off"
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none text-sm" placeholder="Username Admin" />
            </div>
            <div>
              <label className="block text-purple-200 text-xs font-semibold mb-2 uppercase tracking-widest">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none text-sm" placeholder="••••••••" />
            </div>
            {loginError && <p className="text-red-400 text-xs text-center font-medium bg-red-950/40 py-2.5 rounded-xl border border-red-500/20">{loginError}</p>}
            <button type="submit" className="w-full py-3.5 rounded-xl text-white font-bold text-sm tracking-widest transition-all hover:scale-[1.01] shadow-[0_4px_20px_rgba(126,34,206,0.3)]" style={{ background: 'linear-gradient(135deg, #c084fc, #7e22ce)' }}>
              VERIFIKASI & MASUK
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- SCREEN INTERFACE: MAIN MANAGEMENT DASHBOARD ---
  return (
    <>
      <Head>
        <title>NotulenAI — Workspace Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

          html, body {
            max-width: 100vw;
            overflow-x: hidden;
            background: linear-gradient(135deg, #0b0f19 0%, #111827 50%, #1e1b4b 100%);
            background-attachment: fixed;
            font-family: 'Inter', sans-serif;
            color: #f3f4f6;
            margin: 0;
            padding: 0;
          }

          .glass-panel {
            background: rgba(17, 24, 39, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          }

          .glass-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .glass-card:hover {
            transform: translateY(-4px);
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(167, 139, 250, 0.3);
            box-shadow: 0 15px 35px rgba(139, 92, 246, 0.15);
          }

          .glass-input {
            background: rgba(0, 0, 0, 0.4) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            color: #e5e7eb !important;
            transition: all 0.2s ease;
          }
          .glass-input:focus {
            border-color: #a78bfa !important;
            box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.15) !important;
            outline: none;
          }

          .btn-glossy {
            background: linear-gradient(135deg, #a78bfa, #6d28d9);
            box-shadow: 0 4px 15px rgba(109, 40, 217, 0.4);
            color: white;
            transition: all 0.2s ease;
          }
          .btn-glossy:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(109, 40, 217, 0.6);
          }

          .badge-draft { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.25); }
          .badge-review { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); }
          .badge-final { background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.25); }

          ::-webkit-scrollbar { height: 6px; width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
          ::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.4); border-radius: 10px; }
        `}</style>
      </Head>

      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden">
        {/* Modern Header Navigation */}
        <nav className="glass-panel sticky top-0 z-50 border-t-0 border-l-0 border-r-0 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-inner" style={{ background: 'linear-gradient(135deg, #a78bfa, #6d28d9)' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-fuchsia-200">
                NOTULEN<span className="text-white">AI</span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-purple-300/70 text-xs font-mono hidden lg:block bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <button onClick={handleLogout} className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition border border-transparent hover:border-red-500/20">
                Keluar
              </button>
              <Link href="/tambah">
                <button className="btn-glossy flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Buat Notulen
                </button>
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Dashboard Info Title */}
          <div className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider text-white" style={{ textShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                CORE <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">DASHBOARD</span>
              </h1>
              <p className="text-purple-300/60 text-xs mt-1">Management berkas rapat terotomatisasi kecerdasan artifisial</p>
            </div>
          </div>

          {/* Cards Metrics Dynamic Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Manuskrip', value: stats.total, icon: '📋', color: '#a78bfa' },
              { label: 'Status Final', value: stats.final, icon: '✨', color: '#34d399' },
              { label: 'Draf Peninjauan', value: stats.draft, icon: '📂', color: '#fbbf24' },
              { label: 'Agregasi Bulan Ini', value: stats.thisMonth, icon: '⚡', color: '#38bdf8' },
            ].map((s, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-purple-300/50 tracking-wider">{s.label}</span>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <div className="text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)` }}></div>
              </div>
            ))}
          </div>

          {/* Data Table Core Viewport */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            {/* Filter Toolset Bar */}
            <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-bold tracking-widest text-white uppercase">REKAPITULASI DATA</span>
                <span className="bg-purple-500/10 text-purple-300 px-2.5 py-0.5 rounded-md text-[11px] font-bold border border-purple-500/20">
                  {filtered.length} Berkas
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" placeholder="Cari arsip..." value={search} onChange={e => setSearch(e.target.value)} className="glass-input w-full pl-9 pr-4 py-2 rounded-xl text-xs" />
                </div>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="glass-input px-3 py-2 rounded-xl text-xs w-full sm:w-auto" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="glass-input px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
                  <option value="" style={{ color: '#000' }}>Semua Status</option>
                  <option value="draft" style={{ color: '#000' }}>Draft</option>
                  <option value="review" style={{ color: '#000' }}>Review</option>
                  <option value="final" style={{ color: '#000' }}>Final</option>
                </select>
                {filterDate && (
                  <button onClick={() => setFilterDate('')} className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Response Rendering Logic */}
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-purple-300/60 font-medium">Sinkronisasi Database...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="text-4xl mb-3 opacity-40">📥</div>
                  <p className="text-purple-300 text-sm font-medium mb-1">Tidak ada data notulen ditemukan</p>
                  <p className="text-purple-400/40 text-xs mb-4">Silakan sesuaikan filter kata kunci atau buat entri baru</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-black/40 text-purple-300 text-[11px] uppercase tracking-wider font-semibold border-b border-white/5">
                      <th className="px-6 py-4 text-center w-12">No</th>
                      <th className="px-6 py-4">Judul Notulensi</th>
                      <th className="px-6 py-4">Tanggal Rapat</th>
                      <th className="px-6 py-4 hidden md:table-cell">Tempat Pelaksanaan</th>
                      <th className="px-6 py-4 hidden lg:table-cell">Pimpinan Rapat</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n, i) => (
                      <tr key={n.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition duration-150">
                        <td className="px-6 py-4 text-center font-bold text-purple-400/70">{i + 1}</td>
                        <td className="px-6 py-4 max-w-xs sm:max-w-md">
                          <div className="text-white font-semibold text-sm truncate mb-0.5">{n.judul}</div>
                          <div className="text-[10px] font-mono text-purple-400/50">{n.id}</div>
                        </td>
                        <td className="px-6 py-4 text-purple-200 font-medium">{n.tanggal ? formatDate(n.tanggal) : '-'}</td>
                        <td className="px-6 py-4 text-purple-300/80 hidden md:table-cell truncate max-w-xs">{n.tempat || '-'}</td>
                        <td className="px-6 py-4 text-purple-300/80 hidden lg:table-cell truncate max-w-xs">{n.pimpinan_rapat || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusBadge(n.status)}`}>
                            {statusLabel[n.status] || n.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link href={`/notulen/${n.id}`}>
                              <button className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition" title="Buka">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </button>
                            </Link>
                            <Link href={`/tambah?edit=${n.id}`}>
                              <button className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition" title="Ubah">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                            </Link>
                            <Link href={`/cetak/${n.id}`} target="_blank">
                              <button className="p-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 transition" title="Print PDF">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
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
    </>
  );
}
