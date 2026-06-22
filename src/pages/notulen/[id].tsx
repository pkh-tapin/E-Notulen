import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

interface NotulenData {
  id?: string;
  judul: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string;
  tempat: string;
  pimpinan_rapat: string;
  notulis: string;
  peserta: string;
  agenda: string;
  isi_notulen: string;
  kesimpulan: string;
  tindak_lanjut: string;
  status: string;
}

export default function LaporanResmi() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<NotulenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  // Sistem Proteksi Akses (Role Kontrol)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (id) {
      fetch(`/api/notulen`)
        .then(res => res.json())
        .then(result => {
          if (Array.isArray(result)) {
            const found = result.find((item: any) => item.id === id);
            setData(found || null);
            // Jika status dokumen bukan rahasia, otomatis buka gembok untuk publik
            if (found && found.status !== 'rahasia') {
              setIsUnlocked(true);
            }
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setIsUnlocked(true);
      setPinError('');
    } else {
      setPinError('Akses Ditolak: PIN Invalid!');
      setPinInput('');
    }
  };

  // ENGINE CETAK PDF MULTI-HALAMAN (ANTI-TERPOTONG & ANTI-HILANG)
  const generatePDF = async () => {
    if (!data) return;
    setPrinting(true);

    const printArea = document.getElementById('formal-report-area');
    if (!printArea) return;

    const opt = {
      margin: [15, 0, 15, 0], // Margin atas/bawah memberikan ruang aman untuk halaman baru
      filename: `LAPORAN_NOTULEN_${data.tanggal}_${data.id?.substring(0, 5)}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      pagebreak: { mode: ['css'] }, // Menggunakan pembagian halaman berbasis CSS murni
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const runPDF = async () => {
      try {
        await (window as any).html2pdf().set(opt).from(printArea).save();
      } catch (err) {
        console.error("Gagal memproses dokumen PDF:", err);
      } finally {
        setPrinting(false);
      }
    };

    if (!(window as any).html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runPDF;
      document.head.appendChild(script);
    } else {
      runPDF();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <i className="fa-solid fa-circle-notch fa-spin text-yellow-500 text-3xl"></i>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Sinkronisasi Jalur Berkas...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <h1 className="text-xl font-black text-slate-800 mb-2">404 — DATA BERKAS TIDAK DITEMUKAN</h1>
        <Link href="/" className="px-5 py-2 bg-yellow-400 text-yellow-950 font-bold rounded-xl text-xs">Kembali ke Dashboard</Link>
      </div>
    );
  }

  // TAMPILAN LOCK SCREEN JIKA AKSES BERSTATUS RAHASIA (BUKAN ADMIN)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 text-2xl">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1">Arsip Tertutup (Vault Admin)</h2>
          <p className="text-slate-500 text-xs mb-6 leading-relaxed">Dokumen ini dikategorikan sebagai RAHASIA. Masukkan PIN Otorisasi untuk membuka konten.</p>
          <form onSubmit={handleVerifyPin} className="space-y-3">
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="••••" className="w-full text-center py-3 border border-slate-200 rounded-xl bg-slate-50 text-2xl tracking-[0.2em] outline-none focus:border-yellow-400 focus:bg-white font-mono" autoFocus />
            {pinError && <p className="text-red-500 text-xs font-bold">{pinError}</p>}
            <button type="submit" className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-md transition-all">Buka Gembok</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Laporan Resmi: {data.judul}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="min-h-screen bg-slate-50 w-full text-slate-800 pb-12">
        
        {/* TOP BAR ACTION */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 w-full shadow-sm print:hidden">
          <div className="w-full max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="text-slate-600 hover:text-yellow-600 transition-colors font-bold text-xs uppercase flex items-center gap-2">
              <i className="fa-solid fa-arrow-left"></i> Kembali
            </Link>
            <button onClick={generatePDF} disabled={printing} className="px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase transition-all bg-yellow-400 hover:bg-yellow-500 text-yellow-950 shadow-md flex items-center gap-2">
              {printing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-print"></i>}
              {printing ? 'Menyusun PDF...' : 'Download Laporan PDF'}
            </button>
          </div>
        </nav>

        {/* CONTAINER UTAMA PREVIEW */}
        <div className="w-full max-w-3xl mx-auto mt-8 px-4 print:p-0">
          
          {/* AREA DOKUMEN CETAK (MURNI ELEMENT BLOCK - ANTI CUTTING) */}
          <div id="formal-report-area" className="bg-white p-10 md:p-16 border border-slate-200 shadow-sm print:border-none print:p-0 print:shadow-none" style={{ color: '#000', fontFamily: 'Arial, sans-serif' }}>
            
            {/* KOP SURAT INSTANSI */}
            <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '12px', marginBottom: '25px', display: 'block' }}>
              <h1 style={{ margin: '0', fontSize: '15pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LAPORAN HASIL KEGIATAN & NOTULENSI</h1>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase' }}>SDM PROGRAM KELUARGA HARAPAN (PKH)</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '11pt', fontWeight: 'bold' }}>KABUPATEN TAPIN</p>
            </div>

            {/* I. PEMBUKAAN */}
            <div style={{ marginBottom: '25px', display: 'block', pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #eab308', margin: '0 0 12px 0', textTransform: 'uppercase' }}>I. Pembukaan & Identitas Rapat</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
                <tbody>
                  <tr><td style={{ width: '28%', padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Judul Kegiatan</td><td style={{ width: '3%', verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0', fontWeight: 'bold' }}>{data.judul}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Hari / Tanggal</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0' }}>{data.tanggal}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Waktu Kegiatan</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0' }}>{data.waktu_mulai || '-'} s/d {data.waktu_selesai || 'Selesai'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Tempat Pelaksanaan</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0' }}>{data.tempat || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Pimpinan Sidang</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0' }}>{data.pimpinan_rapat || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Notulis / Pencatat</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0' }}>{data.notulis || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Daftar Peserta Hadir</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{data.peserta || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Agenda Utama Rapat</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{data.agenda || '-'}</td></tr>
                </tbody>
              </table>
            </div>

            {/* II. PEMBAHASAN MENDALAM */}
            <div style={{ marginBottom: '25px', display: 'block' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #eab308', margin: '0 0 12px 0', textTransform: 'uppercase', pageBreakInside: 'avoid' }}>II. Hasil Pembahasan / Notulensi</h3>
              <div style={{ fontSize: '11pt', lineHeight: '1.6', textAlign: 'justify', whiteSpace: 'pre-wrap', wordWrap: 'break-word', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0', display: 'block' }}>
                {data.isi_notulen || 'Tidak ada catatan isi pembahasan.'}
              </div>
            </div>

            {/* III. KESIMPULAN EKSEKUTIF (POINT TO POINT) */}
            <div style={{ marginBottom: '25px', display: 'block', pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #ef4444', margin: '0 0 12px 0', textTransform: 'uppercase' }}>III. Kesimpulan Eksekutif</h3>
              <div style={{ fontSize: '11pt', padding: '12px 16px', backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px', fontWeight: 'bold', lineHeight: '1.6', textAlign: 'justify', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                {data.kesimpulan || 'Tidak ada data kesimpulan.'}
              </div>
            </div>

            {/* IV. RENCANA TINDAK LANJUT */}
            <div style={{ marginBottom: '35px', display: 'block' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #0f172a', margin: '0 0 12px 0', textTransform: 'uppercase', pageBreakInside: 'avoid' }}>IV. Rencana Tindak Lanjut (RTL)</h3>
              <div style={{ fontSize: '11pt', lineHeight: '1.6', textAlign: 'justify', whiteSpace: 'pre-wrap', wordWrap: 'break-word', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0', display: 'block' }}>
                {data.tindak_lanjut || '-'}
              </div>
            </div>

            {/* BLOK TANDA TANGAN */}
            <div style={{ marginTop: '50px', textAlign: 'right', display: 'block', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'inline-block', textAlign: 'center', width: '240px', fontSize: '11pt' }}>
                <p style={{ margin: '0 0 65px 0' }}>Tapin, {data.tanggal}</p>
                <p style={{ margin: '0', fontWeight: 'bold', textDecoration: 'underline' }}>{data.pimpinan_rapat || '...........................................'}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '10pt', color: '#475569' }}>Pimpinan Rapat</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
