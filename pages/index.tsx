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
      </Head>

      <div className="min-h-screen grid-bg" style={{ background: '#020818' }}>
        {/* Navbar */}
        <nav className="border-b border-cyan-500/20 bg-navy-900/80 backdrop-blur sticky top-0 z-50" style={{ background: '#040d2b95' }}>
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded border border-cyan-400/50 flex items-center justify-center" style={{ background: '#22d3ee15' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-cyan-400" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-display text-xl font-semibold tracking-wider text-cyan-300">NOTULEN<span className="text-white">AI</span></span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-sm font-mono hidden md:block">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <Link href="/tambah">
                <button className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all" 
                  style={{ background: '#22d3ee20', border: '1px solid #22d3ee50', color: '#22d3ee' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = '#22d3ee30'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = '#22d3ee20'; }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                  Tambah Notulen
                </button>
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 animate-fade-up">
            <h1 className="font-display text-4xl font-bold tracking-widest text-white mb-1">
              DASHBOARD <span className="text-cyan-400">NOTULEN</span>
            </h1>
            <p className="text-slate-400 text-sm">Sistem manajemen notulen rapat berbasis AI</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up">
            {[
              { label: 'Total Notulen', value: stats.total, icon: '📋', color: '#22d3ee' },
              { label: 'Notulen Final', value: stats.final, icon: '✅', color: '#34d399' },
              { label: 'Masih Draft', value: stats.draft, icon: '📝', color: '#fbbf24' },
              { label: 'Bulan Ini', value: stats.thisMonth, icon: '📅', color: '#a78bfa' },
            ].map((s, i) => (
              <div key={i} className="card-futuristic rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xl">{s.icon}</span>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: s.color }} />
                </div>
                <div className="font-display text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-slate-400 text-xs mt-1 font-mono uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-3 mb-6 animate-fade-up">
            <div className="flex-1 relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari notulen, tempat, pimpinan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded text-sm text-slate-200 placeholder-slate-600 outline-none transition-all"
                style={{ background: '#061240', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }}
                onFocus={e => e.target.style.borderColor = '#22d3ee50'}
                onBlur={e => e.target.style.borderColor = '#22d3ee20'}
              />
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-2.5 rounded text-sm text-slate-200 outline-none"
              style={{ background: '#061240', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }}
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded text-sm text-slate-200 outline-none"
              style={{ background: '#061240', border: '1px solid #22d3ee20', fontFamily: 'Exo 2, sans-serif' }}
            >
              <option value="">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="final">Final</option>
            </select>
            {filterDate && (
              <button onClick={() => setFilterDate('')}
                className="px-3 py-2 rounded text-xs text-red-400 transition-colors"
                style={{ background: '#ff000015', border: '1px solid #ff000030' }}>
                Reset
              </button>
            )}
          </div>

          {/* Table */}
          <div className="card-futuristic rounded-xl overflow-hidden animate-fade-up">
            <div className="px-5 py-4 border-b border-cyan-500/10 flex items-center justify-between">
              <span className="font-display text-lg font-semibold tracking-wider text-cyan-300">
                DAFTAR NOTULEN
              </span>
              <span className="text-slate-500 text-xs font-mono">{filtered.length} data</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Memuat data...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-slate-400">Belum ada notulen</p>
                  <Link href="/tambah">
                    <span className="text-cyan-400 text-sm cursor-pointer hover:underline">Tambah notulen pertama →</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase tracking-widest font-mono" style={{ background: '#040d2b80' }}>
                      <th className="px-5 py-3 text-left">No</th>
                      <th className="px-5 py-3 text-left">Judul Rapat</th>
                      <th className="px-5 py-3 text-left hidden md:table-cell">Tanggal</th>
                      <th className="px-5 py-3 text-left hidden lg:table-cell">Tempat</th>
                      <th className="px-5 py-3 text-left hidden lg:table-cell">Pimpinan</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n, i) => (
                      <tr key={n.id}
                        className="border-t border-cyan-500/10 transition-colors hover:bg-cyan-500/5 group">
                        <td className="px-5 py-4 text-slate-600 font-mono text-xs">{i + 1}</td>
                        <td className="px-5 py-4">
                          <div className="text-slate-200 font-medium group-hover:text-cyan-300 transition-colors">{n.judul}</div>
                          <div className="text-slate-600 text-xs mt-0.5 font-mono">{n.id}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-400 hidden md:table-cell font-mono text-xs">
                          {n.tanggal ? formatDate(n.tanggal) : '-'}
                        </td>
                        <td className="px-5 py-4 text-slate-400 hidden lg:table-cell text-xs">{n.tempat || '-'}</td>
                        <td className="px-5 py-4 text-slate-400 hidden lg:table-cell text-xs">{n.pimpinan_rapat || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-mono uppercase tracking-wider ${statusBadge(n.status)}`}>
                            {statusLabel[n.status] || n.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Link href={`/notulen/${n.id}`}>
                              <button className="p-1.5 rounded transition-colors text-cyan-500 hover:text-cyan-300 hover:bg-cyan-500/10" title="Lihat">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </Link>
                            <Link href={`/tambah?edit=${n.id}`}>
                              <button className="p-1.5 rounded transition-colors text-yellow-500 hover:text-yellow-300 hover:bg-yellow-500/10" title="Edit">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </Link>
                            <Link href={`/cetak/${n.id}`} target="_blank">
                              <button className="p-1.5 rounded transition-colors text-green-500 hover:text-green-300 hover:bg-green-500/10" title="Cetak">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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
    </>
  );
}
