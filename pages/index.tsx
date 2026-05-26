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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [notulen, setNotulen] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [stats, setStats] = useState({ total: 0, final: 0, draft: 0, thisMonth: 0 });

  useEffect(() => {
    if (localStorage.getItem('admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.toLowerCase() === 'admin' && password === 'admin123') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Akses ditolak. Periksa kredensial Anda.');
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
      const all = Array.isArray(data) ? data : [];
      setNotulen(all);

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
    catch { return d || '-'; }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { 
      draft: 'bg-amber-500/10 text-amber-400 border-amber-500/30', 
      final: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', 
      review: 'bg-sky-500/10 text-sky-400 border-sky-500/30' 
    };
    return map[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4" style={{ background: 'linear-gradient(135deg, #020818 0%, #040d2b 100%)' }}>
        <Head><title>Portal Login — E-GENLAP</title></Head>
        
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-sky-600/20 rounded-full filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/20 rounded-full filter blur-[100px] animate-pulse"></div>

        <div className="relative z-10 w-full max-w-md p-8 rounded-3xl" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(20px)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)' }}>
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(2,132,199,0.4)]" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-white tracking-widest">OTORISASI SISTEM</h2>
            <p className="text-sky-300/60 text-[10px] mt-1.5 uppercase tracking-widest font-bold">Portal Manajemen Arsip Terpadu</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off"
              className="w-full px-5 py-4 rounded-xl text-sm font-medium transition-all outline-none" 
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} placeholder="Username Pengelola" />
            
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-5 py-4 rounded-xl text-sm font-medium transition-all outline-none" 
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} placeholder="Password Akses" />
            
            {loginError && <p className="text-red-400 text-xs text-center font-bold bg-red-500/10 py-2.5 rounded-lg border border-red-500/20">{loginError}</p>}
            
            <button type="submit" className="w-full py-4 mt-2 rounded-xl text-white font-bold text-xs tracking-widest uppercase transition-all hover:scale-[1.02] shadow-[0_4px_20px_rgba(2,132,199,0.4)]" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}>
              VERIFIKASI AKSES
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>E-GENLAP — Dashboard Arsip</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
          @import url('[https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap)');
          html, body { max-width: 100vw; overflow-x: hidden; background: linear-gradient(135deg, #020818 0%, #040d2b 100%); background-attachment: fixed; font-family: 'Plus Jakarta Sans', sans-serif; color: #fff; margin: 0; padding: 0; }
          .glass-panel { background: rgba(4, 13, 43, 0.7); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
          .glass-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
          .glass-card:hover { transform: translateY(-4px); background: rgba(255, 255, 255, 0.04); border-color: rgba(56, 189, 248, 0.3); box-shadow: 0 15px 35px rgba(2, 132, 199, 0.2); }
          .input-glossy { background: rgba(0, 0, 0, 0.4) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; color: #fff !important; transition: all 0.2s ease; }
          .input-glossy:focus { border-color: #38bdf8 !important; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15) !important; outline: none; }
          .btn-glossy { background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4); color: white; transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.1); }
          .btn-glossy:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(2, 132, 199, 0.6); }
        `}</style>
      </Head>

      <div className="min-h-screen w-full">
        {/* Navbar */}
        <nav className="glass-panel sticky top-0 z-50 border-t-0 border-l-0 border-r-0">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="3"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <span className="text-base md:text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-white">
                E-GENLAP<span className="text-sky-400">.AI</span>
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <span className="text-sky-200/70 text-[10px] font-mono hidden md:block bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 uppercase font-bold tracking-wider">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <button onClick={handleLogout} className="text-[10px] font-bold text-red-400 hover:text-red-300 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 uppercase tracking-widest">
                Keluar
              </button>
              <Link href="/tambah">
                <button className="btn-glossy flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold tracking-widest uppercase">
                  <span className="hidden sm:inline">Buat Arsip</span>
                  <span className="sm:hidden">Buat</span>
                </button>
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-black tracking-widest text-white mb-1 uppercase">
              Dashboard <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-400">Pusat</span>
            </h1>
            <p className="text-sky-200/60 text-[10px] md:text-xs uppercase font-bold tracking-widest">Rekapitulasi Manuskrip Rapat Organisasi</p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
            {[
              { label: 'Total Arsip', value: stats.total, color: '#38bdf8' },
              { label: 'Finalisasi', value: stats.final, color: '#34d399' },
              { label: 'Draf Validasi', value: stats.draft, color: '#fbbf24' },
              { label: 'Siklus Bulanan', value: stats.thisMonth, color: '#818cf8' },
            ].map((s, i) => (
              <div key={i} className="glass-card rounded-2xl p-4 md:p-6 relative overflow-hidden">
                <div className="text-[9px] md:text-[10px] font-black uppercase text-sky-200/50 tracking-widest mb-1">{s.label}</div>
                <div className="text-3xl md:text-4xl font-black" style={{ color: s.color, textShadow: `0 0 20px ${s.color}40` }}>{s.value}</div>
                <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)` }}></div>
              </div>
            ))}
          </div>

          {/* Main Table Panel */}
          <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
            {/* Filter Tools */}
            <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-sky-500 rounded-full shadow-[0_0_10px_#38bdf8]"></div>
                <span className="text-xs font-black tracking-widest text-white uppercase">DATABASE</span>
                <span className="bg-sky-500/20 text-sky-200 px-2.5 py-1 rounded-md text-[9px] font-black tracking-wider border border-sky-500/30">
                  {filtered.length} DITEMUKAN
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
                <input type="text" placeholder="Pencarian spesifik..." value={search} onChange={e => setSearch(e.target.value)} 
                  className="input-glossy w-full sm:w-56 px-4 py-2.5 rounded-xl text-xs font-medium" />
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} 
                  className="input-glossy w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-medium [color-scheme:dark]" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} 
                  className="input-glossy w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-medium appearance-none">
                  <option value="" style={{ color: '#000' }}>Semua Status</option>
                  <option value="draft" style={{ color: '#000' }}>Draft</option>
                  <option value="review" style={{ color: '#000' }}>Review</option>
                  <option value="final" style={{ color: '#000' }}>Final</option>
                </select>
                {filterDate && (
                  <button onClick={() => setFilterDate('')} className="px-4 py-2.5 rounded-xl text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 uppercase tracking-widest">
                    RESET
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin shadow-[0_0_15px_#38bdf8]" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24"><p className="text-sky-200/50 text-xs font-bold tracking-widest uppercase">Kueri Tidak Ditemukan</p></div>
            ) : (
              <>
                {/* MOBILE VIEW: Card List */}
                <div className="md:hidden flex flex-col divide-y divide-white/5">
                  {filtered.map((n) => (
                    <div key={n.id} className="p-5 bg-white/[0.01]">
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <div className="max-w-[70%]">
                          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">{n.judul}</h3>
                          <span className="text-[9px] font-mono text-sky-400/50 block mt-1">{n.id}</span>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest border border-solid ${statusBadge(n.status)}`}>
                          {n.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-sky-200/70 font-medium py-3 border-y border-white/5 my-3">
                        <div>📅 {formatDate(n.tanggal)}</div>
                        <div className="truncate">📍 {n.tempat || '-'}</div>
                        <div className="col-span-2 truncate">👤 {n.pimpinan_rapat || '-'}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Link href={`/notulen/${n.id}`}><button className="w-full py-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-black tracking-widest uppercase">Lihat</button></Link>
                        <Link href={`/tambah?edit=${n.id}`}><button className="w-full py-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black tracking-widest uppercase">Ubah</button></Link>
                        <Link href={`/cetak/${n.id}`} target="_blank"><button className="w-full py-2.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 text-[9px] font-black tracking-widest uppercase">Cetak</button></Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* PC VIEW: Wide Table */}
                <div className="hidden md:block overflow-x-auto w-full">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead>
                      <tr className="bg-white/[0.02] text-sky-200/60 text-[9px] uppercase tracking-widest font-black border-b border-white/10">
                        <th className="px-6 py-5 text-center w-14">#</th>
                        <th className="px-6 py-5">Identitas Dokumen</th>
                        <th className="px-6 py-5">Atribut Pelaksanaan</th>
                        <th className="px-6 py-5">Pimpinan</th>
                        <th className="px-6 py-5 text-center">Status</th>
                        <th className="px-6 py-5 text-center w-36">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {filtered.map((n, i) => (
                        <tr key={n.id} className="hover:bg-white/[0.02] transition duration-200">
                          <td className="px-6 py-4 text-center font-black text-sky-500/50">{i + 1}</td>
                          <td className="px-6 py-4 max-w-xs">
                            <div className="text-white font-bold text-sm truncate mb-1">{n.judul}</div>
                            <div className="text-[9px] font-mono text-sky-400/50 tracking-wider">{n.id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sky-100 font-bold mb-1">{formatDate(n.tanggal)}</div>
                            <div className="text-[10px] text-sky-200/60 truncate max-w-[200px]">{n.tempat || '-'}</div>
                          </td>
                          <td className="px-6 py-4 text-sky-100 font-medium truncate max-w-[150px]">{n.pimpinan_rapat || '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border border-solid ${statusBadge(n.status)}`}>
                              {n.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <Link href={`/notulen/${n.id}`}><button className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 transition" title="Lihat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button></Link>
                              <Link href={`/tambah?edit=${n.id}`}><button className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition" title="Ubah"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button></Link>
                              <Link href={`/cetak/${n.id}`} target="_blank"><button className="p-2.5 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 transition" title="Cetak"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
