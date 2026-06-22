import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

interface NotulenData {
  id?: string; judul: string; tanggal: string; waktu_mulai: string; waktu_selesai: string;
  tempat: string; pimpinan_rapat: string; notulis: string; peserta: string;
  agenda: string; isi_notulen: string; kesimpulan: string; tindak_lanjut: string; status: string;
}

export default function LaporanResmi() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<NotulenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (id) {
      fetch(`/api/notulen`).then(res => res.json()).then(result => {
        if (Array.isArray(result)) {
          const found = result.find((item: any) => item.id === id);
          setData(found || null);
          if (found && found.status !== 'rahasia') setIsUnlocked(true);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') { setIsUnlocked(true); setPinError(''); } 
    else { setPinError('Akses Ditolak: PIN Invalid!'); setPinInput(''); }
  };

  // ALGORITMA PEMISAH PARAGRAF ANTI-CUTTING
  // Ini akan membelah teks per poin (Enter) dan memberinya pelindung
  const formatUntukPDF = (text?: string) => {
    if (!text) return '<div style="margin-bottom: 8px;">Tidak ada catatan.</div>';
    return text.split('\n').filter(p => p.trim() !== '').map(p => 
      `<div style="page-break-inside: avoid; margin-bottom: 12px; text-align: justify; line-height: 1.6;">${p.replace(/\*/g, '')}</div>`
    ).join('');
  };

  const generatePDF = async () => {
    if (!data) return;
    setPrinting(true);
    const printArea = document.getElementById('formal-report-area');
    if (!printArea) return;

    // Margin atas & bawah disesuaikan agar rapi
    const opt = {
      margin: [15, 15, 15, 15], 
      filename: `LAPORAN_NOTULEN_${data.tanggal}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      pagebreak: { mode: ['css'] }, 
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const runPDF = async () => {
      try {
        await (window as any).html2pdf().set(opt).from(printArea).save();
      } catch (err) {
        console.error("Gagal memproses dokumen PDF:", err);
      } finally { setPrinting(false); }
    };

    if (!(window as any).html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runPDF;
      document.head.appendChild(script);
    } else runPDF();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><i className="fa-solid fa-circle-notch fa-spin text-yellow-500 text-3xl"></i></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><h1>Data Tidak Ditemukan</h1></div>;
  if (!isUnlocked) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 text-2xl"><i className="fa-solid fa-lock"></i></div>
        <h2 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1">Arsip Tertutup (Vault Admin)</h2>
        <form onSubmit={handleVerifyPin} className="space-y-3 mt-4">
          <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="••••" className="w-full text-center py-3 border border-slate-200 rounded-xl bg-slate-50 text-2xl tracking-[0.2em] outline-none focus:border-yellow-400 font-mono" autoFocus />
          {pinError && <p className="text-red-500 text-xs font-bold">{pinError}</p>}
          <button type="submit" className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 rounded-xl font-extrabold text-xs uppercase shadow-md">Buka Gembok</button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>Laporan Resmi: {data.judul}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      <div className="min-h-screen bg-slate-50 w-full text-slate-800 pb-12">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 w-full shadow-sm print:hidden">
          <div className="w-full max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="text-slate-600 hover:text-yellow-600 transition-colors font-bold text-xs uppercase flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Kembali</Link>
            <button onClick={generatePDF} disabled={printing} className="px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase bg-yellow-400 hover:bg-yellow-500 text-yellow-950 shadow-md flex items-center gap-2">
              {printing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-print"></i>}
              {printing ? 'Menyusun PDF...' : 'Download Laporan PDF'}
            </button>
          </div>
        </nav>

        <div className="w-full max-w-3xl mx-auto mt-8 px-4 print:p-0">
          <div id="formal-report-area" className="bg-white p-10 border border-slate-200 shadow-sm print:border-none print:p-0 print:shadow-none" style={{ color: '#000', fontFamily: 'Arial, sans-serif' }}>
            
            <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '12px', marginBottom: '25px' }}>
              <h1 style={{ margin: '0', fontSize: '15pt', fontWeight: 'bold', textTransform: 'uppercase' }}>LAPORAN HASIL KEGIATAN & NOTULENSI</h1>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '12pt', fontWeight: 'bold' }}>SDM PROGRAM KELUARGA HARAPAN (PKH)</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '11pt', fontWeight: 'bold' }}>KABUPATEN TAPIN</p>
            </div>

            <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #eab308', marginBottom: '12px', textTransform: 'uppercase' }}>I. Pembukaan & Identitas Rapat</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
                <tbody>
                  <tr><td style={{ width: '28%', padding: '5px 0', fontWeight: 'bold' }}>Judul Kegiatan</td><td style={{ width: '3%' }}>:</td><td style={{ padding: '5px 0', fontWeight: 'bold' }}>{data.judul}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold' }}>Hari / Tanggal</td><td>:</td><td style={{ padding: '5px 0' }}>{data.tanggal}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold' }}>Waktu Kegiatan</td><td>:</td><td style={{ padding: '5px 0' }}>{data.waktu_mulai || '-'} s/d {data.waktu_selesai || 'Selesai'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold' }}>Tempat Pelaksanaan</td><td>:</td><td style={{ padding: '5px 0' }}>{data.tempat || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold' }}>Pimpinan Sidang</td><td>:</td><td style={{ padding: '5px 0' }}>{data.pimpinan_rapat || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold' }}>Notulis / Pencatat</td><td>:</td><td style={{ padding: '5px 0' }}>{data.notulis || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Daftar Peserta Hadir</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0', whiteSpace: 'pre-wrap' }}>{data.peserta || '-'}</td></tr>
                  <tr><td style={{ padding: '5px 0', fontWeight: 'bold', verticalAlign: 'top' }}>Agenda Utama Rapat</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ padding: '5px 0', whiteSpace: 'pre-wrap' }}>{data.agenda || '-'}</td></tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #eab308', marginBottom: '12px', textTransform: 'uppercase', pageBreakInside: 'avoid' }}>II. Hasil Pembahasan / Notulensi</h3>
              <div style={{ fontSize: '11pt', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0' }} dangerouslySetInnerHTML={{ __html: formatUntukPDF(data.isi_notulen) }}></div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #ef4444', marginBottom: '12px', textTransform: 'uppercase', pageBreakInside: 'avoid' }}>III. Kesimpulan Eksekutif</h3>
              <div style={{ fontSize: '11pt', padding: '12px 16px', backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px', fontWeight: 'bold' }} dangerouslySetInnerHTML={{ __html: formatUntukPDF(data.kesimpulan) }}></div>
            </div>

            <div style={{ marginBottom: '35px' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '6px 10px', borderLeft: '4px solid #0f172a', marginBottom: '12px', textTransform: 'uppercase', pageBreakInside: 'avoid' }}>IV. Rencana Tindak Lanjut (RTL)</h3>
              <div style={{ fontSize: '11pt', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0' }} dangerouslySetInnerHTML={{ __html: formatUntukPDF(data.tindak_lanjut) }}></div>
            </div>

            <div style={{ marginTop: '50px', textAlign: 'right', pageBreakInside: 'avoid' }}>
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
