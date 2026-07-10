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
  isLocked?: boolean; // Field Status Kunci Dokumen
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

  // Backward compatibility helper
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSuperAdmin = userRole === 'superadmin';

  // =========================================================================
  // SYNC REALTIME DATABASE
  // =========================================================================
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
                          (item.agenda?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (item.kesimpulan?.toLowerCase() || '').includes(searchTerm.toLowerCase());
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

  // TOGGLE LOCK STATUS DI FIREBASE
  const handleToggleLock = async (item: Notulen) => {
    if (!isAdmin) return;
    const currentLockStatus = item.isLocked !== false; // Default true jika undefined
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
  // REKAYASA TOTAL ENGINE CETAK PDF RESMI (ANTI-HANCUR) - FIXED INDENTASI
  // =========================================================================
  const handleCetakPDF = async (item: Notulen) => {
    setPrintingId(item.id);
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '-9999px';

    const formatHtmlPDF = (textData?: string | string[] | null) => {
      if (!textData) return '-';
      const text = Array.isArray(textData) ? textData.join('\n') : String(textData);
      
      return text.split('\n').map(line => {
        // Hapus regex yang membersihkan tanda bintang
        const cleanLine = line;
        if (!cleanLine.trim()) return '<div style="height: 12px;"></div>';
        
        // Deteksi prefix dan indentasi
        const leadingSpacesMatches = line.match(/^(\s*)/);
        const leadingSpaces = leadingSpacesMatches ? leadingSpacesMatches[1].length : 0;
        
        // Atur indentasi berdasarkan spasi di awal
        const paddingLeft = leadingSpaces * 20; // 20px per indentation level

        // Deteksi daftar bertingkat
        const isList = /^\s*([0-9]+\.|^-|^[a-zA-Z]\.)/i.test(line);
        const linePadding = isList ? 'padding-left: 25px;' : 'padding-left: 0px;';
        
        return `<p style="margin: 0 0 8px 0; text-align: justify; text-justify: inter-word; line-height: 1.6; ${linePadding} padding-left: ${paddingLeft}px;">${cleanLine.trim()}</p>`;
      }).join('');
    };
    
    printContainer.innerHTML = `
      <div id="print-capture-area" style="padding: 25mm 20mm 20mm 25mm; font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; width: 210mm; box-sizing: border-box; font-size: 12pt;">
        
        <div style="text-align: center; border-bottom: 4px double #000; padding-bottom: 12px; margin-bottom: 30px;">
          <h1 style="margin: 0 0 4px 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">LAPORAN HASIL KEGIATAN & NOTULENSI RAPAT</h1>
          <h2 style="margin: 0 0 4px 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">SUMBER DAYA MANUSIA PROGRAM KELUARGA HARAPAN</h2>
          <h3 style="margin: 0; font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">KABUPATEN TAPIN</h3>
        </div>

        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h4 style="margin: 0 0 12px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">I. DOKUMEN IDENTITAS KEGIATAN</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12pt; table-layout: fixed;">
            <tr>
              <td style="width: 28%; padding: 4px 0; vertical-align: top;">Nama Kegiatan</td>
              <td style="width: 3%; padding: 4px 0; vertical-align: top; text-align: center;">:</td>
              <td style="width: 69%; padding: 4px 0; vertical-align: top; font-weight: bold; text-align: justify;">${item.judul || '-'}</td>
            </tr>
            <tr>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">Hari / Tanggal</td>
              <td style="vertical-align: top; padding: 4px 0; text-align: center; padding-top: 5px;">:</td>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">${item.tanggal || '-'}</td>
            </tr>
            <tr>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">Waktu Pelaksanaan</td>
              <td style="vertical-align: top; padding: 4px 0; text-align: center; padding-top: 5px;">:</td>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">${item.waktu_mulai || '-'} s/d ${item.waktu_selesai || 'Selesai'} WITA</td>
            </tr>
            <tr>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">Tempat / Lokasi</td>
              <td style="vertical-align: top; padding: 4px 0; text-align: center; padding-top: 5px;">:</td>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px; text-align: justify;">${item.tempat || '-'}</td>
            </tr>
            <tr>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">Pimpinan Rapat</td>
              <td style="vertical-align: top; padding: 4px 0; text-align: center; padding-top: 5px;">:</td>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">${item.pimpinan_rapat || '-'}</td>
            </tr>
            <tr>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">Notulis</td>
              <td style="vertical-align: top; padding: 4px 0; text-align: center; padding-top: 5px;">:</td>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">${item.notulis || '-'}</td>
            </tr>
            <tr>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">Agenda Pembahasan</td>
              <td style="vertical-align: top; padding: 4px 0; text-align: center; padding-top: 5px;">:</td>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px; text-align: justify;">${item.agenda || '-'}</td>
            </tr>
            <tr>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px;">Daftar Hadir Peserta</td>
              <td style="vertical-align: top; padding: 4px 0; text-align: center; padding-top: 5px;">:</td>
              <td style="vertical-align: top; padding: 4px 0; padding-top: 5px; text-align: justify; word-wrap: break-word;">${item.peserta ? item.peserta.replace(/\n/g, ', ') : '-'}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 12px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">II. JALANNYA RAPAT DAN PEMBAHASAN</h4>
          <div style="text-align: justify; text-justify: inter-word;">
            ${formatHtmlPDF(item.isi_notulen)}
          </div>
        </div>

        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h4 style="margin: 0 0 12px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">III. KESIMPULAN AKHIR</h4>
          <div style="text-align: justify; text-justify: inter-word;">
            ${formatHtmlPDF(item.kesimpulan || item.ai_structured?.ringkasan)}
          </div>
        </div>

        <div style="margin-bottom: 45px; page-break-inside: avoid;">
          <h4 style="margin: 0 0 12px 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">IV. RENCANA TINDAK LANJUT (RTL)</h4>
          <div style="text-align: justify; text-justify: inter-word;">
            ${formatHtmlPDF(item.tindak_lanjut || item.ai_structured?.tindak_lanjut)}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; page-break-inside: avoid; table-layout: fixed;">
          <tr>
            <td style="width: 50%;"></td>
            <td style="width: 50%; text-align: center; line-height: 1.5;">
              <p style="margin: 0 0 75px 0;">Tapin, ${item.tanggal || '...........................'}</p>
              <p style="margin: 0; font-weight: bold; text-decoration: underline; text-transform: uppercase;">${item.pimpinan_rapat || '...................................................'}</p>
              <p style="margin: 4px 0 0 0; font-size: 11pt; color: #333;">Pimpinan Rapat / Penanggung Jawab</p>
            </td>
          </tr>
        </table>

      </div>
    `;
    document.body.appendChild(printContainer);

    const opt = {
      margin: [0, 0, 0, 0], 
      filename: `OFFICIAL_NOTULEN_${item.tanggal}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { scale: 2.5, useCORS: true, letterRendering: true, logging: false },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const runPDF = async () => {
      try {
        const worker = (window as any).html2pdf().set(opt).from(document.getElementById('print-capture-area'));
        await worker.save();
      } catch (err) {
        console.error("PDF Engine Crash:", err);
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

  const hitungTotal = data.filter(d => isAdmin || d.status !== 'rahasia').length;
  const hitungFinal = data.filter(d => d.status === 'final').length;
  const hitungRahasia = data.filter(d => d.status === 'rahasia').length;
  const hitungDraft = data.filter(d => d.status === 'draft' || d.status === 'review').length;

  return (
    <>
      <Head>
        <title>Dashboard Arsip | SDM PKH Tapin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 pb-12 selection:bg-yellow-200 relative">
        
        {/* ========================================================= */}
        {/* POP-UP DETAIL MODAL (PREVIEW) - FIXED MOBILE LAYOUT */}
        {/* ========================================================= */}
        {viewItem && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-full sm:max-w-3xl relative overflow-hidden shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[90vh] h-[90vh] sm:h-auto">
              
              <div className="px-5 py-4 sm:p-6 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wide">Detail Notulen Resmi</h2>
                    <p className="text-[10px] sm:text-xs text-slate-500">{viewItem.tanggal} • {viewItem.waktu_mulai || '-'} WITA</p>
                  </div>
                </div>
                <button onClick={() => setViewItem(null)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                <h1 className="text-lg sm:text-2xl font-black text-slate-800 mb-6 leading-tight">{viewItem.judul}</h1>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4 mb-8 p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="border-b border-slate-100 sm:border-0 pb-3 sm:pb-0">
                    <span className="block text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Pimpinan Rapat</span>
                    <span className="text-sm font-semibold text-slate-700">{viewItem.pimpinan_rapat || '-'}</span>
                  </div>
                  <div className="border-b border-slate-100 sm:border-0 pb-3 sm:pb-0">
                    <span className="block text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Lokasi</span>
                    <span className="text-sm font-semibold text-slate-700">{viewItem.tempat || '-'}</span>
                  </div>
                  <div className="sm:col-span-2 pt-1 sm:pt-0">
                    <span className="block text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Agenda Utama</span>
                    <span className="text-sm font-medium text-slate-700">{viewItem.agenda || '-'}</span>
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Hasil Pembahasan
                    </h3>
                    <div className="list-content text-sm text-slate-600 leading-loose whitespace-pre-wrap text-justify bg-white">
                      {viewItem.isi_notulen ? formatModalListContent(viewItem.isi_notulen) : '-'}
                    </div>
                  </div>
                  
                  <div className="p-4 sm:p-5 rounded-2xl bg-yellow-50/50 border border-yellow-100">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-yellow-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Kesimpulan Eksekutif
                    </h3>
                    <div className="list-content text-sm text-yellow-900/80 leading-relaxed whitespace-pre-wrap text-justify">
                      {viewItem.kesimpulan || viewItem.ai_structured?.ringkasan ? 
                        formatModalListContent(viewItem.kesimpulan || viewItem.ai_structured?.ringkasan || '') : '-'}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Tindak Lanjut (RTL)
                    </h3>
                    <div className="list-content text-sm text-slate-600 leading-relaxed whitespace-pre-wrap text-justify">
                      {viewItem.tindak_lanjut || viewItem.ai_structured?.tindak_lanjut ?
                        formatModalListContent(viewItem.tindak_lanjut || viewItem.ai_structured?.tindak_lanjut || '') : '-'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-5 py-4 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0">
                <button onClick={() => setViewItem(null)} className="w-full sm:w-auto px-6 py-2.5 sm:py-2.5 rounded-xl bg-slate-200 text-slate-700 text-xs sm:text-[11px] font-bold hover:bg-slate-300 transition-colors">Tutup</button>
                <button 
                  onClick={() => handleCetakPDF(viewItem)}
                  className="w-full sm:w-auto px-6 py-2.5 sm:py-2.5 rounded-xl bg-yellow-400 text-yellow-950 text-xs sm:text-[11px] font-bold hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Cetak Dokumen Resmi
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* MULTI-ROLE SECURITY MODAL AUTH */}
        {showPinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-7 w-full max-w-sm relative overflow-hidden shadow-2xl border border-slate-100">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-400"></div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    Otorisasi Penjaga
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Admin (1234) | Super Admin (9999)</p>
                </div>
                <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <form onSubmit={handlePinSubmit}>
                <input 
                  type="password" 
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 outline-none text-center text-3xl tracking-[0.3em] mb-2 font-mono transition-all"
                  placeholder="••••"
                />
                {pinError && <p className="text-red-500 text-xs mb-4 text-center font-bold">{pinError}</p>}
                <button type="submit" className="w-full py-3.5 bg-yellow-400 text-yellow-950 rounded-xl hover:bg-yellow-500 transition-all font-extrabold text-xs tracking-widest shadow-lg shadow-yellow-400/30">
                  VERIFIKASI PIN
                </button>
              </form>
            </div>
          </div>
        )}

        {/* DELETE MODAL (SUPER ADMIN ONLY) */}
        {deleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-red-100 shadow-2xl">
              <h3 className="text-base font-extrabold text-red-600 mb-2 uppercase tracking-wide flex items-center gap-2">
              Hapus Permanen Core Data?
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">Otorisasi Super Admin Terbaca. Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors text-xs font-bold uppercase tracking-wide">Batal</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all text-xs font-bold uppercase tracking-wide shadow-lg shadow-red-500/30">
                  {isDeleting ? 'Menghapus...' : 'Ya, Bersihkan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NAVBAR */}
        <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 w-full shadow-sm">
          <div className="w-full max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-400 flex items-center justify-center text-yellow-950 font-black text-lg shadow-md shadow-yellow-400/40">N</div>
              <h1 className="font-extrabold tracking-widest text-slate-800 text-sm sm:text-base uppercase">
                AI Note <span className="text-yellow-500">Tapin</span>
              </h1>
            </div>
            
            <div className="flex gap-3 items-center">
              <Link href="/tambah" className="px-4 py-2.5 bg-yellow-400 rounded-xl text-yellow-950 font-extrabold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-yellow-500 transition-all shadow-md shadow-yellow-400/30 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">Buat Baru</span>
              </Link>
              <button 
                onClick={handleAdminToggle} 
                className={`px-3 py-2.5 rounded-xl transition-all border flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                  userRole === 'superadmin' ? 'bg-red-50 border-red-300 text-red-600 shadow-md shadow-red-400/10' :
                  userRole === 'admin' ? 'bg-yellow-50 border-yellow-400 text-yellow-600 shadow-md shadow-yellow-400/20' : 
                  'bg-slate-50 border-slate-200 text-slate-400 hover:text-yellow-500 hover:bg-slate-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" /></svg>
                <span>{userRole === 'public' ? 'Login' : userRole}</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 mt-8">
          
          {/* STATISTIK ARSIP */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center">
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5">Total Arsip</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 font-mono">{hitungTotal}</h2>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center">
              <p className="text-emerald-600 text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5">Finalized</p>
              <h2 className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">{hitungFinal}</h2>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center">
              <p className="text-orange-500 text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5">
                {isAdmin ? '🔒 Vault Rahasia' : '📝 Drafting'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-orange-500 font-mono">
                {isAdmin ? hitungRahasia : hitungDraft}
              </h2>
            </div>
          </div>

          {/* SEARCH & FILTER */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex-1 relative flex items-center">
              <svg className="w-5 h-5 text-slate-400 absolute left-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="Pencarian judul, agenda, atau rangkuman AI..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 transition-all text-sm font-medium"
              />
            </div>
            <div className="w-full sm:w-56">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 text-sm font-bold appearance-none cursor-pointer"
              >
                <option value="all">📁 Semua Status</option>
                <option value="final">✅ Dokumen Final</option>
                <option value="review">👁️ Tahap Review</option>
                <option value="draft">📝 Status Draft</option>
                {isAdmin && <option value="rahasia">🔒 DOKUMEN RAHASIA</option>}
              </select>
            </div>
          </div>

          {/* LIST DATA CARDS */}
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1, 2, 3].map(n => (
               <div key={n} className="bg-white rounded-2xl p-6 h-56 animate-pulse border border-slate-100 shadow-sm" />
             ))}
           </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">0 Data Terdeteksi</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {paginatedData.map((item) => {
                const isLockedDoc = item.isLocked !== false; // Default true jika undefined/belum diset
                // BISA EDIT JIKA: Dokumen Terbuka (isLockedDoc == false) ATAU User adalah Admin/SuperAdmin
                const canUserEdit = !isLockedDoc || isAdmin;

                return (
                  <div key={item.id} className={`bg-white rounded-2xl p-6 border ${item.status === 'rahasia' ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'border-slate-200 shadow-sm'} hover:shadow-xl hover:-translate-y-1 hover:border-yellow-400 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden`}>
                    
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${item.status === 'rahasia' ? 'bg-yellow-400' : 'bg-slate-200 group-hover:bg-yellow-400'} transition-colors`}></div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-4 mt-1">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                          {item.tanggal}
                        </span>
                        
                        {/* INDIKATOR STATUS KUNCI (ADMIN & SUPER ADMIN BISA KLIK UNTUK TOGGLE LOCK) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleLock(item)}
                            disabled={!isAdmin}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border transition-all ${
                              isLockedDoc 
                                ? 'bg-red-50 text-red-600 border-red-200' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            } ${isAdmin ? 'hover:scale-105 cursor-pointer' : 'cursor-not-allowed'}`}
                            title={isAdmin ? "Klik untuk merubah kunci dokumen" : "Status Kunci Dokumen"}
                          >
                            {isLockedDoc ? '🔒 Terkunci' : '🔓 Terbuka'}
                          </button>
                          
                          <span className={`text-[9px] font-black tracking-wider px-2.5 py-1 rounded-md uppercase border ${
                            item.status === 'final' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                            item.status === 'rahasia' ? 'bg-yellow-100 text-yellow-700 border-yellow-400' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="text-base font-extrabold text-slate-800 mb-3 leading-snug group-hover:text-yellow-600 transition-colors line-clamp-2">
                        {item.judul}
                      </h3>
                      
                      {item.agenda && (
                        <div className="mb-4 flex items-start gap-2 text-xs text-slate-600 line-clamp-2">
                          <span className="leading-relaxed">{item.agenda}</span>
                        </div>
                      )}

                      <div className="mb-4 p-3.5 rounded-xl bg-yellow-50/50 border border-yellow-100 text-xs text-slate-700 line-clamp-3 relative">
                        <span className="leading-relaxed font-medium">
                          {item.kesimpulan || item.ai_structured?.ringkasan || 'Belum ada kesimpulan AI.'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 mt-2 border-t border-slate-100">
                      {/* ACTION GRID: LIHAT, EDIT, PRINT */}
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => setViewItem(item)} 
                          className="py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] font-bold text-center hover:bg-slate-100 transition-all"
                        >
                          Lihat
                        </button>
                        
                        {canUserEdit ? (
                          <Link 
                            href={`/tambah?edit=${item.id}`}
                            className="py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] font-bold text-center hover:bg-slate-100 transition-all block"
                          >
                            Edit
                          </Link>
                        ) : (
                          <button 
                            disabled
                            className="py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 text-[11px] font-bold text-center cursor-not-allowed opacity-60"
                            title="Dokumen Terkunci. Hanya Super Admin/Admin yang dapat mengedit atau membuka kunci."
                          >
                            🔒 Edit
                          </button>
                        )}

                        <button 
                          onClick={() => handleCetakPDF(item)}
                          disabled={printingId === item.id}
                          className="py-2.5 bg-yellow-400 text-yellow-950 rounded-xl text-[11px] font-extrabold hover:bg-yellow-500 transition-all disabled:opacity-50"
                        >
                          {printingId === item.id ? '...' : 'Print'}
                        </button>
                      </div>

                      {/* AREA SUPER ADMIN ONLY: HAPUS */}
                      {isSuperAdmin && (
                        <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                          <button 
                            onClick={() => setDeleteId(item.id)} 
                            className="w-full py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-wide hover:bg-red-100 transition-colors"
                          >
                            🗑️ Hapus Permanen (Super Admin)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION PANEL */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-2 pb-8">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors">
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`w-9 h-9 text-xs font-bold rounded-xl transition-all border ${currentPage === page ? 'bg-yellow-400 text-yellow-950 border-yellow-400 shadow-md shadow-yellow-400/30' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{page}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors">
                ›
              </button>
            </div>
          )}

        </div>
      </div>
      
      {/* ========================================================= */}
      {/* FIXED MOBILE LIST INDENTATION CSS */}
      {/* ========================================================= */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        /* Indentasi manual untuk daftar bertingkat di mobile modal */
        .list-content p { margin: 0 0 12px 0; text-align: justify; line-height: 1.8; }
        .pre-indent-1 { padding-left: 20px; display: block; margin-left: -20px; }
        .pre-indent-2 { padding-left: 40px; display: block; margin-left: -40px; }
        .pre-indent-3 { padding-left: 60px; display: block; margin-left: -60px; }
        .pre-indent-4 { padding-left: 80px; display: block; margin-left: -80px; }
      `}} />
    </>
  );
}

// Fungsi pembantu untuk memformat konten teks bertingkat di modal
const formatModalListContent = (text: string) => {
  return text.split('\n').map((line, index) => {
    // Hapus regex yang membersihkan tanda bintang
    const cleanLine = line;
    if (!cleanLine.trim()) return <div key={index} style={{ height: '12px' }}></div>;
    
    // Deteksi prefix dan indentasi
    const leadingSpacesMatches = line.match(/^(\s*)/);
    const leadingSpaces = leadingSpacesMatches ? leadingSpacesMatches[1].length : 0;
    
    // Tentukan level indentasi (misalnya: 2 spasi per level)
    const indentationLevel = Math.floor(leadingSpaces / 2);
    
    return (
      <span key={index} className={`pre-indent-${indentationLevel}`}>
        {cleanLine.trim()}
      </span>
    );
  });
};
