import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// =========================================================================
// IMPORT FIREBASE REALTIME DATABASE 
// (Sesuai dengan struktur folder Anda di src/lib/firebase.ts)
// =========================================================================
import { ref, onValue, remove } from 'firebase/database';
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
}

export default function DashboardPremium() {
  const [data, setData] = useState<Notulen[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdmin, setIsAdmin] = useState(false);
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

  // =========================================================================
  // SINKRONISASI REALTIME DENGAN FIREBASE
  // =========================================================================
  useEffect(() => {
    setLoading(true);
    const notulenRef = ref(db, 'notulen');
    
    // onValue akan terus mendengarkan perubahan data secara realtime
    const unsubscribe = onValue(notulenRef, (snapshot) => {
      if (snapshot.exists()) {
        const dataObj = snapshot.val();
        
        // Ubah object Firebase menjadi array
        const formattedData = Object.keys(dataObj).map(key => ({
          id: key,
          ...dataObj[key]
        })) as Notulen[];

        // Urutkan berdasarkan tanggal terbaru
        const sortedData = formattedData.sort((a, b) => {
          return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
        });
        
        setData(sortedData);
      } else {
        setData([]); // Jika database kosong
      }
      setLoading(false);
    }, (error) => {
      console.error("Gagal sinkronisasi dari Firebase:", error);
      setLoading(false);
    });

    // Cleanup listener
    return () => unsubscribe();
  }, []);

  // =========================================================================
  // SISTEM FILTER KHUSUS ADMIN (TIDAK BISA DITEMBUS TANPA PIN)
  // =========================================================================
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Jika bukan admin, dokumen berstatus 'rahasia' disembunyikan total
      if (!isAdmin && item.status === 'rahasia') return false;

      const matchSearch = (item.judul?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (item.agenda?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (item.ai_structured?.ringkasan?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, searchTerm, statusFilter, isAdmin]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false); 
      // Reset filter jika admin logout agar data rahasia tidak nyangkut
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
      setIsAdmin(true);
      setShowPinModal(false);
    } else {
      setPinError('Akses Ditolak: PIN Invalid!');
      setPinInput('');
    }
  };

  // =========================================================================
  // HAPUS DATA PERMANEN DARI FIREBASE
  // =========================================================================
  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const targetRef = ref(db, `notulen/${deleteId}`);
      await remove(targetRef);
      // Tidak perlu setData manual karena onValue (realtime) akan otomatis update UI
      setDeleteId(null);
    } catch (err) {
      console.error("Gagal menghapus data:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ENGINE CETAK PDF (AUTO-BOLD & ALENIA)
  const handleCetakPDF = async (item: Notulen) => {
    setPrintingId(item.id);
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '-9999px';

    const formatHtmlPDF = (textData?: string | string[] | null) => {
      let text = "";
      if (Array.isArray(textData)) text = textData.join('\n');
      else if (typeof textData === 'string') text = textData;
      
      if (!text || text.trim() === '') return '<div style="margin-bottom: 8px;">-</div>';
      
      return text.split('\n').filter(p => p.trim() !== '').map(p => {
        let cleanText = p.replace(/\*/g, '').trim();
        
        // Detektif Pintar: Cari awalan "1." (Utama) atau "a." (Anak Poin)
        let isMainPoint = /^\d+\.\s/.test(cleanText);
        let isSubPoint = /^[a-z]\.\s/i.test(cleanText) || cleanText.startsWith('-');
        
        // Aturan Visual: Poin Utama = Tebal & Spasi Atas | Anak Poin = Menjorok
        let paddingLeft = isSubPoint ? '28px' : '0px';
        let fontWeight = isMainPoint ? 'bold' : 'normal';
        let textTransform = isMainPoint ? 'uppercase' : 'none';
        let marginTop = isMainPoint ? '14px' : '6px'; // Jarak agar tidak berdempetan

        return `<div style="page-break-inside: avoid; margin-top: ${marginTop}; margin-bottom: 4px; text-align: justify; line-height: 1.6; padding-left: ${paddingLeft}; font-weight: ${fontWeight}; text-transform: ${textTransform};">${cleanText}</div>`;
      }).join('');
    };
    
    printContainer.innerHTML = `
      <div id="print-capture-area" style="padding: 15mm 20mm; font-family: 'Arial', sans-serif; color: #000; background: #fff; width: 210mm; box-sizing: border-box;">
        <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 25px;">
          <h1 style="margin: 0; font-size: 15pt; font-weight: bold; text-transform: uppercase;">LAPORAN HASIL KEGIATAN & NOTULENSI</h1>
          <h2 style="margin: 4px 0 0 0; font-size: 12pt; font-weight: bold;">SDM PROGRAM KELUARGA HARAPAN (PKH)</h2>
          <p style="margin: 4px 0 0 0; font-size: 11pt; font-weight: bold;">KABUPATEN TAPIN</p>
        </div>

        <div style="margin-bottom: 22px; page-break-inside: avoid;">
          <h3 style="font-size: 11pt; font-weight: bold; background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #eab308; margin-bottom: 10px;">I. Pembukaan & Identitas Rapat</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 11pt;">
            <tr><td style="width: 28%; padding: 4px 0; font-weight: bold;">Judul Kegiatan</td><td style="width: 3%;">:</td><td style="padding: 4px 0; font-weight: bold;">${item.judul || '-'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Hari, Tanggal</td><td>:</td><td style="padding: 4px 0;">${item.tanggal || '-'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Waktu Pelaksanaan</td><td>:</td><td style="padding: 4px 0;">${item.waktu_mulai || '-'} s/d ${item.waktu_selesai || 'Selesai'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Tempat / Lokasi</td><td>:</td><td style="padding: 4px 0;">${item.tempat || '-'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Pimpinan Rapat</td><td>:</td><td style="padding: 4px 0;">${item.pimpinan_rapat || '-'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Notulis / Pencatat</td><td>:</td><td style="padding: 4px 0;">${item.notulis || '-'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold; vertical-align: top;">Peserta</td><td style="vertical-align: top;">:</td><td style="padding: 4px 0; white-space: pre-wrap;">${item.peserta || '-'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold; vertical-align: top;">Agenda</td><td style="vertical-align: top;">:</td><td style="padding: 4px 0; white-space: pre-wrap;">${item.agenda || '-'}</td></tr>
          </table>
        </div>

        <div style="margin-bottom: 22px;">
          <h3 style="font-size: 11pt; font-weight: bold; background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #eab308; margin-bottom: 10px; page-break-inside: avoid;">II. Hasil Pembahasan / Notulensi</h3>
          <div style="font-size: 11pt;">${formatHtmlPDF(item.isi_notulen)}</div>
        </div>

        <div style="margin-bottom: 22px;">
          <h3 style="font-size: 11pt; font-weight: bold; background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #ef4444; margin-bottom: 10px; page-break-inside: avoid;">III. Kesimpulan Eksekutif</h3>
          <div style="padding: 12px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 6px; font-size: 11pt;">${formatHtmlPDF(item.kesimpulan || item.ai_structured?.ringkasan)}</div>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 11pt; font-weight: bold; background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #0f172a; margin-bottom: 10px; page-break-inside: avoid;">IV. Rencana Tindak Lanjut (RTL)</h3>
          <div style="font-size: 11pt;">${formatHtmlPDF(item.tindak_lanjut || item.ai_structured?.tindak_lanjut)}</div>
        </div>

        <div style="margin-top: 50px; text-align: right; page-break-inside: avoid;">
          <div style="display: inline-block; text-align: center; width: 240px; font-size: 11pt;">
            <p style="margin: 0 0 65px 0;">Tapin, ${item.tanggal || '-'}</p>
            <p style="margin: 0; font-weight: bold; text-decoration: underline;">${item.pimpinan_rapat || '...........................................'}</p>
            <p style="margin: 4px 0 0 0; font-size: 10pt;">Pimpinan Rapat</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(printContainer);

    const opt = {
      margin: [10, 0, 10, 0], 
      filename: `NOTULEN_${item.tanggal}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      pagebreak: { mode: ['css'] },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const runPDF = async () => {
      try {
        const worker = (window as any).html2pdf().set(opt).from(document.getElementById('print-capture-area'));
        await worker.save();
        const pdfBase64 = await worker.outputPdf('datauristring');
        fetch('/api/upload-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfBase64, fileName: opt.filename }) }).catch(()=>console.log("Drive bypass"));
      } catch (err) {
        console.error("PDF Error:", err);
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

      {/* TEMA PUTIH KUNING (Clean Bright Aesthetic) */}
      <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 pb-12 selection:bg-yellow-200">
        
        {/* MODAL PIN ADMIN */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-7 w-full max-w-sm relative overflow-hidden shadow-2xl border border-slate-100">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-400"></div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" /></svg>
                  Otorisasi Admin
                </h3>
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
                  BUKA BRANKAS
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DELETE */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-red-100 shadow-2xl">
              <h3 className="text-base font-extrabold text-red-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Hapus Permanen?
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">Tindakan ini akan menghapus data arsip dari server secara permanen.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors text-xs font-bold uppercase tracking-wide">Batal</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all text-xs font-bold uppercase tracking-wide shadow-lg shadow-red-500/30">
                  {isDeleting ? 'Memproses...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOP NAVBAR PUTIH KUNING */}
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
                <span>Buat Baru</span>
              </Link>
              <button 
                onClick={handleAdminToggle} 
                className={`p-2.5 rounded-xl transition-all border ${isAdmin ? 'bg-yellow-50 border-yellow-400 text-yellow-600 shadow-md shadow-yellow-400/20' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-yellow-500 hover:bg-slate-100'}`}
                title={isAdmin ? "Mode Admin Aktif" : "Login Admin"}
              >
                {isAdmin ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" /></svg>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* KONTEN UTAMA */}
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 mt-8">
          
          {/* KARTU STATISTIK */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full -mr-8 -mt-8"></div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1 relative z-10 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                Total Arsip
              </p>
              <h2 className="text-3xl font-black text-slate-800 font-mono relative z-10">{hitungTotal}</h2>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-8 -mt-8"></div>
              <p className="text-emerald-600 text-[10px] uppercase font-bold tracking-widest mb-1 relative z-10 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Finalized
              </p>
              <h2 className="text-3xl font-black text-emerald-600 font-mono relative z-10">{hitungFinal}</h2>
            </div>
            <div className={`bg-white rounded-2xl p-5 border ${isAdmin ? 'border-yellow-300 bg-yellow-50/30' : 'border-slate-200'} shadow-sm relative overflow-hidden flex flex-col justify-center`}>
              <div className={`absolute top-0 right-0 w-16 h-16 ${isAdmin ? 'bg-yellow-100' : 'bg-orange-50'} rounded-bl-full -mr-8 -mt-8`}></div>
              <p className={`${isAdmin ? 'text-yellow-600' : 'text-orange-500'} text-[10px] uppercase font-bold tracking-widest mb-1 relative z-10 flex items-center gap-1.5`}>
                {isAdmin ? (
                  <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" /></svg>Vault Rahasia</>
                ) : (
                  <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Drafting</>
                )}
              </p>
              <h2 className={`text-3xl font-black ${isAdmin ? 'text-yellow-600' : 'text-orange-500'} font-mono relative z-10`}>
                {isAdmin ? hitungRahasia : hitungDraft}
              </h2>
            </div>
          </div>

          {/* PENCARIAN & FILTER */}
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
                {/* Opsi Rahasia HANYA MUNCUL JIKA ADMIN LOGIN */}
                {isAdmin && <option value="rahasia">🔒 DOKUMEN RAHASIA</option>}
              </select>
            </div>
          </div>

          {/* GRID KARTU NOTULEN (TEMA PUTIH KUNING + KONTEN BARU) */}
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1, 2, 3].map(n => (
               <div key={n} className="bg-white rounded-2xl p-6 h-56 animate-pulse border border-slate-100 shadow-sm">
                 <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
                 <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                 <div className="h-20 bg-slate-100 rounded w-full"></div>
               </div>
             ))}
           </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">0 Data Terdeteksi</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {paginatedData.map((item) => (
                <div key={item.id} className={`bg-white rounded-2xl p-6 border ${item.status === 'rahasia' ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'border-slate-200 shadow-sm'} hover:shadow-xl hover:-translate-y-1 hover:border-yellow-400 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden`}>
                  
                  {/* Garis Aksen Atas */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${item.status === 'rahasia' ? 'bg-yellow-400' : 'bg-slate-200 group-hover:bg-yellow-400'} transition-colors`}></div>
                  
                  <div>
                    {/* Header: Tanggal & Status */}
                    <div className="flex justify-between items-center mb-4 mt-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {item.tanggal}
                      </span>
                      <span className={`text-[9px] font-black tracking-wider px-2.5 py-1 rounded-md uppercase border ${
                        item.status === 'final' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                        item.status === 'rahasia' ? 'bg-yellow-100 text-yellow-700 border-yellow-400 shadow-sm' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {item.status === 'rahasia' ? '🔒 RAHASIA' : item.status}
                      </span>
                    </div>
                    
                    {/* Judul Kegiatan */}
                    <h3 className="text-base font-extrabold text-slate-800 mb-3 leading-snug group-hover:text-yellow-600 transition-colors line-clamp-2">
                      {item.judul}
                    </h3>
                    
                    {/* Agenda Kegiatan */}
                    {item.agenda && (
                      <div className="mb-4 flex items-start gap-2 text-xs text-slate-600 line-clamp-2">
                        <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <span className="leading-relaxed">{item.agenda}</span>
                      </div>
                    )}

                    {/* Kesimpulan Singkat AI */}
                    <div className="mb-4 p-3.5 rounded-xl bg-yellow-50/50 border border-yellow-100 text-xs text-slate-700 line-clamp-3 relative">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        <span className="text-[10px] text-yellow-600 font-extrabold uppercase tracking-widest">Kesimpulan Singkat</span>
                      </div>
                      <span className="leading-relaxed font-medium">
                        {item.kesimpulan || item.ai_structured?.ringkasan || 'Belum ada kesimpulan yang digenerate AI.'}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Aksi Bawah */}
                  <div className="pt-4 mt-2 border-t border-slate-100">
                    <div className="flex gap-2.5">
                      <Link href={`/notulen/${item.id}`} className="flex-1 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] font-bold text-center hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-1.5">
                        Buka Detail
                      </Link>
                      <button 
                        onClick={() => handleCetakPDF(item)}
                        disabled={printingId === item.id}
                        className="flex-1 py-2.5 bg-yellow-400 text-yellow-950 rounded-xl text-[11px] font-extrabold hover:bg-yellow-500 transition-all shadow-md shadow-yellow-400/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        {printingId === item.id ? 'Memproses...' : 'Cetak PDF'}
                      </button>
                    </div>

                    {/* Menu Khusus Admin (Hanya muncul jika gembok terbuka) */}
                    {isAdmin && (
                      <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-dashed border-slate-200 animate-fade-in">
                        <Link href={`/tambah?edit=${item.id}`} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase text-center hover:bg-slate-200 transition-colors tracking-wide">Edit Data</Link>
                        <button onClick={() => setDeleteId(item.id)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100 transition-colors tracking-wide">Hapus Permanen</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-2 pb-8">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50 hover:text-yellow-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`w-9 h-9 text-xs font-bold rounded-xl transition-all border ${currentPage === page ? 'bg-yellow-400 text-yellow-950 border-yellow-400 shadow-md shadow-yellow-400/30' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-yellow-400'}`}>{page}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50 hover:text-yellow-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
