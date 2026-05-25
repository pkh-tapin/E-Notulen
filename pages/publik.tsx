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

export default function DashboardPublik() {
  const [notulen, setNotulen] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [stats, setStats] = useState({ total: 0, final: 0, draft: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const url = filterDate ? `/api/notulen?tanggal=${filterDate}` : '/api/notulen';
      const res = await fetch(url);
      const data = await res.json();
      
      const all = Array.isArray(data) ? data : [];
      setNotulen(all);

      // Kalkulasi Statistik
      setStats({
        total: all.length,
        final: all.filter((n) => n.status?.toLowerCase() === 'final').length,
        draft: all.filter((n) => n.status?.toLowerCase() === 'draft').length,
      });
    } catch (error) {
      console.error("Gagal mengambil data:", error);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter pencarian
  const filteredNotulen = notulen.filter((n) =>
    n.judul?.toLowerCase().includes(search.toLowerCase()) ||
    n.tempat?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-900 text-gray-100 p-4 md:p-8 font-sans">
      <Head>
        <title>Arsip Notulen Publik</title>
      </Head>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">
              Arsip Publik Notulen
            </h1>
            <p className="text-gray-400 mt-1">Sistem Informasi Notulen Rapat (Mode Baca)</p>
          </div>
          <div className="flex items-center gap-3 bg-purple-500/20 px-4 py-2 rounded-full border border-purple-500/30">
            <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-sm font-medium text-purple-200">Akses Publik Aktif</span>
          </div>
        </div>

        {/* ================= STATISTIK ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10">
            <p className="text-gray-400 text-sm font-medium mb-1">Total Rapat</p>
            <p className="text-4xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10">
            <p className="text-gray-400 text-sm font-medium mb-1">Status Final</p>
            <p className="text-4xl font-bold text-green-400">{stats.final}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10">
            <p className="text-gray-400 text-sm font-medium mb-1">Status Draft</p>
            <p className="text-4xl font-bold text-yellow-400">{stats.draft}</p>
          </div>
        </div>

        {/* ================= PENCARIAN & FILTER ================= */}
        <div className="flex flex-col md:flex-row gap-4 bg-white/5 backdrop-blur-lg p-4 rounded-2xl border border-white/10">
          <input
            type="text"
            placeholder="Cari judul atau tempat rapat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition [color-scheme:dark]"
          />
        </div>

        {/* ================= TABEL DATA ================= */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-gray-300 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Tanggal & Waktu</th>
                  <th className="px-6 py-4 font-medium">Judul Rapat</th>
                  <th className="px-6 py-4 font-medium">Pimpinan & Tempat</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-purple-300">
                      <div className="flex justify-center items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"></div>
                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : filteredNotulen.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      Tidak ada data notulen ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredNotulen.map((n) => (
                    <tr key={n.id} className="hover:bg-white/5 transition duration-200 group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-white">
                          {n.tanggal ? format(parseISO(n.tanggal), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {n.waktu_mulai || '-'} s/d {n.waktu_selesai || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate" title={n.judul}>
                        {n.judul}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-200 truncate max-w-[200px]">{n.pimpinan_rapat || '-'}</div>
                        <div className="text-xs text-purple-300 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {n.tempat || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          n.status?.toLowerCase() === 'final' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {n.status?.toUpperCase() || 'DRAFT'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {/* HANYA ADA TOMBOL LIHAT/CETAK */}
                        <Link href={`/${n.id}`} target="_blank">
                          <button className="px-4 py-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border border-fuchsia-500/20 transition flex items-center gap-2 mx-auto">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Lihat Dokumen
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
