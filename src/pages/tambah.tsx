import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ref, onValue, remove, update } from 'firebase/database';
import { db } from '../lib/firebase';

interface AIStructured {
  ringkasan?: string;
  poin_penting?: string[];
  tindak_lanjut?: string[];
}

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
  audio_url?: string;
  ai_structured?: AIStructured;
  isLocked?: boolean;
}

export default function DashboardPremium() {
  const [data, setData] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ROLE SYSTEM: 'public' | 'admin' | 'superadmin'
  const [userRole, setUserRole] = useState<'public' | 'admin' | 'superadmin'>('public');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; 

  const [printingId, setPrintingId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<Notulen | null>(null);

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSuperAdmin = userRole === 'superadmin';

  // SINKRONISASI DATA DARI FIREBASE
  useEffect(() => {
    setLoading(true);
    const notesRef = ref(db, 'notes');
    
    const unsubscribe = onValue(notesRef, (snapshot) => {
      if (snapshot.exists()) {
        const dataObj = snapshot.val();
        const formattedData = Object.keys(dataObj).map(key => ({
          id: key,
          ...dataObj[key]
        })) as Notulen[];

        const sortedData = formattedData.sort((a, b) => {
          return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
        });
        
        setData(sortedData);
      } else {
        setData([]); 
      }
      setLoading(false);
    }, (error) => {
      console.error("Gagal sinkronisasi data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (!isAdmin && item.status === 'rahasia') return false;

      const matchSearch = (item.judul?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (item.agenda?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, searchTerm, statusFilter, isAdmin]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAdminToggle = () => {
    if (userRole !== 'public') {
      setUserRole('public'); 
      if (statusFilter === 'rahasia') setStatusFilter('all');
    } else {
      setShowPinModal(true);
      setPinInput('');
      setPinError('');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') { 
      setUserRole('admin');
      setShowPinModal(false);
    } else if (pinInput === '9999') {
      setUserRole('superadmin');
      setShowPinModal(false);
    } else {
      setPinError('PIN Tidak Valid!');
      setPinInput('');
    }
  };

  // PENGUATAN SISTEM KUNCI OLEH ADMIN / SUPER ADMIN
  const handleToggleLock = async (item: Notulen) => {
    if (!isAdmin) return;
    const currentLockStatus = item.isLocked !== false; 
    try {
      const targetRef = ref(db, `notes/${item.id}`);
      await update(targetRef, { isLocked: !currentLockStatus });
    } catch (err) {
      console.error("Gagal merubah status kunci dokumen:", err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || !isSuperAdmin) return;
    setIsDeleting(true);
    try {
      const targetRef = ref(db, `notes/${deleteId}`);
      await remove(targetRef);
      setDeleteId(null);
    } catch (err) {
      console.error("Gagal menghapus data:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // REKAYASA TOTAL CETAK FORMAT F4 RESMI KEMENKUMHAM / PEMERINTAHAN
  // =========================================================================
  const handleCetakPDF = async (item: Notulen) => {
    setPrintingId(item.id);
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '-9999px';

    const formatHtmlPDF = (textData?: string | null) => {
      if (!textData) return '<p style="margin: 0;">-</p>';
      
      return textData.split('\n').map(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return '<div style="height: 10px;"></div>';
        
        // Deteksi sub-poin otomatis seperti 1., a., b.
        const isSubPoin = /^[a-zA-Z0-9]\./.test(cleanLine);
        const paddingLeft = isSubPoin ? '30px' : '0px';
        const textIndent = isSubPoin ? '-20px' : '0px';

        return `
          <p style="margin: 0 0 8px 0; text-align: justify; text-justify: inter-word; line-height: 1.5; padding-left: ${paddingLeft}; text-indent: ${textIndent}; font-family: 'Times New Roman', serif;">
            ${cleanLine}
          </p>
        `;
      }).join('');
    };
    
    printContainer.innerHTML = `
      <div id="print-capture-area" style="padding: 30mm 20mm 20mm 30mm; font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; width: 215mm; box-sizing: border-box; font-size: 12pt;">
        
        <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 6px; margin-bottom: 25px; page-break-inside: avoid;">
          <h1 style="margin: 0 0 4px 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">LAPORAN HASIL KEGIATAN & NOTULENSI RAPAT</h1>
          <h2 style="margin: 0 0 4px 0; font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">SUMBER DAYA MANUSIA PROGRAM KELUARGA HARAPAN</h2>
          <h3 style="margin: 0; font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">KABUPATEN TAPIN</h3>
        </div>

        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h4 style="margin: 0 0 10px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">I. DOKUMEN IDENTITAS KEGIATAN</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12pt; table-layout: fixed;">
            <tr>
              <td style="width: 30%; padding: 3px 0; vertical-align: top;">Nama Kegiatan</td>
              <td style="width: 3%; padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="width: 67%; padding: 3px 0; vertical-align: top; font-weight: bold; text-align: justify;">${item.judul || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">Hari / Tanggal</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="padding: 3px 0; vertical-align: top;">${item.tanggal || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">Waktu Pelaksanaan</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="padding: 3px 0; vertical-align: top;">${item.waktu_mulai || '-'} s/d ${item.waktu_selesai || 'Selesai'} WITA</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">Tempat / Lokasi</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: justify;">${item.tempat || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">Pimpinan Rapat</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="padding: 3px 0; vertical-align: top;">${item.pimpinan_rapat || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">Notulis / Pencatat</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="padding: 3px 0; vertical-align: top;">${item.notulis || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">Daftar Hadir Peserta</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: justify; word-wrap: break-word;">${item.peserta || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">Agenda Pembahasan</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: center;">:</td>
              <td style="padding: 3px 0; vertical-align: top; text-align: justify; word-wrap: break-word;">${item.agenda || '-'}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 10px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase; page-break-inside: avoid;">II. JALANNYA RAPAT DAN PEMBAHASAN</h4>
          <div style="text-align: justify;">
            ${formatHtmlPDF(item.isi_notulen)}
          </div>
        </div>

        <div style="margin-bottom: 35px; page-break-inside: avoid;">
          <h4 style="margin: 0 0 10px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">III. KESIMPULAN AKHIR</h4>
          <div style="text-align: justify;">
            ${formatHtmlPDF(item.kesimpulan || item.ai_structured?.ringkasan)}
          </div>
        </div>

        ${(item.tindak_lanjut || item.ai_structured?.tindak_lanjut) ? `
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h4 style="margin: 0 0 10px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">IV. RENCANA TINDAK LANJUT (RTL)</h4>
          <div style="text-align: justify;">
            ${formatHtmlPDF(item.tindak_lanjut || item.ai_structured?.tindak_lanjut)}
          </div>
        </div>
        ` : ''}

        {/* TANDA TANGAN PEJABAT */}
        <table style="width: 100%; border-collapse: collapse; page-break-inside: avoid; table-layout: fixed;">
          <tr>
            <td style="width: 50%;"></td>
            <td style="width: 50%; text-align: center; line-height: 1.5;">
              <p style="margin: 0 0 65px 0;">Tapin, ${item.tanggal || '...........................'}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline; text-transform: uppercase;">${item.pimpinan_rapat || '...................................................'}</p>
              <p style="margin: 2px 0 0 0; font-size: 11pt; color: #444;">Pimpinan Rapat / Penanggung Jawab</p>
            </td>
          </tr>
        </table>

      </div>
    `;
    document.body.appendChild(printContainer);

    // KUNCI RESOLUSI TINGGI KHUSUS UKURAN F4 (215mm x 330mm)
    const opt = {
      margin: 0,
      filename: `OFFICIAL_NOTULEN_${item.tanggal}_${item.judul.substring(0, 15)}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true, logging: false },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      jsPDF: { unit: 'mm', format: [215, 330], orientation: 'portrait' }
    };

    const runPDF = async () => {
      try {
        const worker = (window as any).html2pdf().set(opt).from(document.getElementById('print-capture-area'));
        await worker.save();
      } catch (err) {
        console.error("PDF Engine Error:", err);
      } finally {
        setPrintingId(null);
        document.body.removeChild(printContainer);
      }
    };

    if (!(window as any).html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runPDF;
      document.head.appendChild(script);
    } else runPDF();
  };

  return (
    <>
      <Head>
        <title>Arsip Laporan Resmi | SDM PKH Tapin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="min-h-screen w-full bg-slate-50 text-slate-800 pb-12 relative">
        
        {/* VIEW DETAIL MODAL PREVIEW */}
        {viewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-3xl relative overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold">📄</div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Pratinjau Notulen Resmi</h2>
                    <p className="text-xs text-slate-500">{viewItem.tanggal} • F4 Document Size</p>
                  </div>
                </div>
                <button onClick={() => setViewItem(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors">✕</button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                <h1 className="text-xl font-black text-slate-800 border-b pb-3">{viewItem.judul}</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border">
                  <div><span className="block text-[10px] uppercase font-bold text-slate-400">Pimpinan</span><span className="text-sm font-semibold">{viewItem.pimpinan_rapat}</span></div>
                  <div><span className="block text-[10px] uppercase font-bold text-slate-400">Lokasi</span><span className="text-sm font-semibold">{viewItem.tempat}</span></div>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Isi Pembahasan:</h3>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap text-justify bg-white p-4 border rounded-xl">{viewItem.isi_notulen}</div>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setViewItem(null)} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300">Tutup</button>
                <button onClick={() => handleCetakPDF(viewItem)} className="px-5 py-2 rounded-xl bg-yellow-400 text-yellow-950 text-xs font-bold hover:bg-yellow-500 shadow-md">Cetak F4</button>
              </div>
            </div>
          </div>
        )}
        
        {/* AUTH MODAL SYSTEM */}
        {showPinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Akses Kontrol</h3>
                <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-red-500">✕</button>
              </div>
              <form onSubmit={handlePinSubmit}>
                <input 
                  type="password" 
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border text-center text-2xl tracking-widest font-mono mb-2"
                  placeholder="••••"
                  autoFocus
                />
                {pinError && <p className="text-red-500 text-xs mb-3 text-center font-bold">{pinError}</p>}
                <button type="submit" className="w-full py-3 bg-yellow-400 text-yellow-950 rounded-xl font-bold text-xs uppercase tracking-widest">Verifikasi</button>
              </form>
            </div>
          </div>
        )}

        {/* DELETE MODAL (SUPER ADMIN ONLY) */}
        {deleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm border shadow-2xl">
              <h3 className="text-base font-bold text-red-600 mb-2 uppercase">Hapus Permanen?</h3>
              <p className="text-slate-500 text-xs mb-6">Tindakan ini memerlukan otoritas penuh Super Admin dan data tidak bisa dikembalikan.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Batal</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-xs font-bold">
                  {isDeleting ? 'Proses...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION TOP BAR */}
        <nav className="sticky top-0 z-40 bg-white border-b w-full shadow-sm">
          <div className="w-full max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center font-black">PKH</div>
              <h1 className="font-bold text-sm tracking-wider uppercase">Arsip Digital <span className="text-yellow-600">Tapin</span></h1>
            </div>
            <div className="flex gap-2">
              <Link href="/tambah" className="px-4 py-2 bg-yellow-400 rounded-xl text-yellow-950 font-bold text-xs uppercase flex items-center gap-1">⚡ Tulis Baru</Link>
              <button onClick={handleAdminToggle} className="px-3 py-2 bg-slate-100 rounded-xl text-slate-700 font-bold text-xs uppercase border">
                Role: {userRole}
              </button>
            </div>
          </div>
        </nav>

        {/* CONTAINER UTAMA */}
        <div className="w-full max-w-7xl mx-auto px-4 mt-8">
          
          {/* SEARCH DAN STRUKTUR FILTER */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8 bg-white p-3 rounded-2xl border shadow-sm">
            <input 
              type="text" 
              placeholder="Cari berkas resmi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 border rounded-xl text-sm outline-none focus:border-yellow-400"
            />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border rounded-xl text-sm font-bold"
            >
              <option value="all">Semua Kategori</option>
              <option value="final">Final</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* RENDER GRID DATA UTAMANYA */}
          {loading ? (
            <div className="text-center py-10 font-bold text-slate-400">Menghubungkan ke Pangkalan Data...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedData.map((item) => {
                // NEGASI KONDISI STATUS DOKUMEN (DEFAULT TRUE JIKA UNDEFINED DI DATABASE)
                const isLockedDoc = item.isLocked !== false; 
                const canUserEdit = !isLockedDoc || isAdmin;

                return (
                  <div key={item.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-yellow-400 transition-all group">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-slate-400 font-bold">{item.tanggal}</span>
                        
                        {/* FITUR TOMBOL PENGUNCIAN/LOCKING STRATEGIS */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleLock(item)}
                            disabled={!isAdmin}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                              isLockedDoc ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            } ${isAdmin ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
                          >
                            {isLockedDoc ? '🔒 Terkunci' : '🔓 Terbuka'}
                          </button>
                        </div>
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-sm mb-2 group-hover:text-yellow-600 transition-colors line-clamp-2">{item.judul}</h3>
                      <p className="text-xs text-slate-500 line-clamp-3 bg-slate-50 p-3 rounded-lg border">{item.agenda || 'Tidak ada uraian agenda.'}</p>
                    </div>

                    {/* DASHBOARD ACTION BUTTONS */}
                    <div className="mt-4 pt-3 border-t">
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setViewItem(item)} className="py-2 bg-slate-50 border rounded-xl text-xs font-semibold text-center hover:bg-slate-100">
                          Lihat
                        </button>
                        
                        {canUserEdit ? (
                          <Link href={`/tambah?edit=${item.id}`} className="py-2 bg-slate-50 border rounded-xl text-xs font-semibold text-center hover:bg-slate-100 block">
                            Edit
                          </Link>
                        ) : (
                          <button disabled className="py-2 bg-slate-100 border rounded-xl text-xs font-bold text-slate-400 text-center cursor-not-allowed opacity-60">
                            🔒 Edit
                          </button>
                        )}

                        <button onClick={() => handleCetakPDF(item)} disabled={printingId === item.id} className="py-2 bg-yellow-400 text-yellow-950 rounded-xl text-xs font-bold hover:bg-yellow-500">
                          {printingId === item.id ? '...' : 'Print'}
                        </button>
                      </div>

                      {/* HAK AKSES KHUSUS SUPER ADMIN UNTUK MENGHAPUS BERKAS */}
                      {isSuperAdmin && (
                        <button onClick={() => setDeleteId(item.id)} className="w-full mt-2 py-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold uppercase hover:bg-red-100 transition-colors">
                          🗑️ Hapus Dokumen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
