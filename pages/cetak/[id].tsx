import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
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
  notulis: string;
  peserta: string;
  agenda: string;
  isi_notulen: string;
  kesimpulan: string;
  tindak_lanjut: string;
  status: string;
  created_at: string;
}

export default function CetakNotulen() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<Notulen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/notulen?id=${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'dd MMMM yyyy', { locale: idLocale }); }
    catch { return d; }
  };

  const handlePrint = () => {
    window.print();
  };

  // FUNGSI CANGGIH: Membersihkan karakter bintang (*) bawaan AI agar layar & cetakan 100% bersih
  const cleanAiText = (str?: string) => {
    if (!str) return '';
    return str.replace(/\*/g, '').trim();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1e1b4b' }}>
        <p style={{ color: '#c4b5fd', fontSize: '1.2rem', fontWeight: '500', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>Memuat Data Cerdas...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1e1b4b' }}>
        <p style={{ color: '#f87171', fontSize: '1.2rem' }}>⚠️ Notulen tidak ditemukan</p>
      </div>
    );
  }

  const pesertaList = data.peserta ? cleanAiText(data.peserta).split(/[\n,]+/).map(p => p.trim()).filter(Boolean) : [];

  return (
    <>
      <Head>
        <title>Notulen — {cleanAiText(data.judul)}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Times+New+Roman&display=swap');

          /* ==============================================================
             MODE LAYAR (SCREEN) : Glassmorphism Soft Purple & Presentation
             (TIDAK DIUBAH SAMA SEKALI - TETAP PERFECT SEPERTI ASLINYA)
             ============================================================== */
          @media screen {
            body { 
              margin: 0; 
              padding: 0; 
              background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%);
              background-attachment: fixed;
              font-family: 'Inter', sans-serif;
              color: #f3f4f6;
            }
            
            .document-container {
              max-width: 800px;
              margin: 2rem auto;
              padding: 2.5rem;
              background: rgba(255, 255, 255, 0.05);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 24px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
            }

            .main-title-wrap {
              text-align: center;
              margin-bottom: 2rem;
              padding-bottom: 1.5rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .badge-top {
              display: inline-block;
              padding: 6px 16px;
              background: linear-gradient(135deg, #8b5cf6, #6d28d9);
              border-radius: 30px;
              font-size: 0.8rem;
              font-weight: 600;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin-bottom: 1rem;
              box-shadow: 0 4px 15px rgba(109, 40, 217, 0.4);
            }

            .doc-title { font-size: 1.8rem; font-weight: 700; line-height: 1.3; text-wrap: balance; }

            .section-card {
              background: rgba(0, 0, 0, 0.2);
              border-radius: 16px;
              padding: 1.5rem;
              margin-bottom: 1.5rem;
              border: 1px solid rgba(255, 255, 255, 0.05);
              transition: transform 0.2s;
            }
            
            .section-card:hover { background: rgba(0, 0, 0, 0.25); }

            .info-grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 12px;
            }

            @media (min-width: 600px) {
              .info-grid { grid-template-columns: 1fr 1fr; }
            }

            .info-item { display: flex; flex-direction: column; gap: 4px; }
            .info-label { font-size: 0.85rem; color: #a78bfa; font-weight: 500; text-transform: uppercase; }
            .info-value { font-size: 1.05rem; font-weight: 500; color: #fff; }

            .section-header {
              font-size: 1.1rem;
              color: #c4b5fd;
              font-weight: 600;
              margin-bottom: 1rem;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .content-text {
              font-size: 1rem;
              line-height: 1.7;
              color: #e5e7eb;
              white-space: pre-line;
            }

            .print-only, .ttd-area { display: none !important; }

            .fab-print {
              position: fixed;
              bottom: 30px;
              right: 30px;
              background: linear-gradient(135deg, #c084fc, #7e22ce);
              color: white;
              border: none;
              border-radius: 50px;
              padding: 16px 28px;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 10px 25px rgba(126, 34, 206, 0.5), inset 0 2px 0 rgba(255,255,255,0.2);
              display: flex;
              align-items: center;
              gap: 10px;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              z-index: 100;
            }
            .fab-print:hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 15px 35px rgba(126, 34, 206, 0.6); }
            
            .peserta-table { width: 100%; border-collapse: collapse; }
            .peserta-table th { text-align: left; padding: 10px; color: #a78bfa; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .peserta-table td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
          }

          /* ==============================================================
             MODE CETAK (PRINT) : UPGRADE! LAPORAN RESMI KELAS DINAS/KANTOR
             ============================================================== */
          @media print {
            @page { margin: 2.5cm; size: A4 portrait; }
            
            body { 
              background: white !important; 
              color: black !important; 
              font-family: 'Times New Roman', Times, serif !important; 
              font-size: 12pt !important;
            }

            .screen-only, .fab-print { display: none !important; }
            
            .document-container {
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
              backdrop-filter: none !important;
            }

            .main-title-wrap {
              text-align: center;
              margin-bottom: 25px;
              border-bottom: 3px double #000;
              padding-bottom: 15px;
            }

            .print-title {
              font-size: 16pt !important;
              font-weight: bold !important;
              text-transform: uppercase !important;
              letter-spacing: 1px !important;
              color: #000 !important;
            }
            .print-subtitle { 
              font-size: 13pt !important; 
              font-weight: bold !important; 
              margin-top: 8px !important;
              color: #000 !important;
              text-transform: uppercase !important;
            }

            .section-card { margin-bottom: 20px; padding: 0; background: transparent !important; border: none !important; }

            /* Formal Info Table Layout */
            .info-table-print {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              line-height: 1.5;
            }
            .info-table-print td { vertical-align: top; padding: 4px 0; color: #000 !important; font-size: 12pt !important; }
            .it-label { width: 25%; font-weight: bold !important; }
            .it-colon { width: 3%; text-align: center; }
            .it-value { width: 72%; }

            .section-header {
              font-size: 12pt !important;
              font-weight: bold !important;
              margin: 25px 0 10px 0 !important;
              text-transform: uppercase !important;
              color: #000 !important;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }

            /* UPGRADE: Teks Justify dan Spasi Elegan untuk Hasil AI */
            .content-text {
              text-align: justify !important;
              line-height: 1.6 !important;
              white-space: pre-wrap !important;
              color: #000 !important;
              font-size: 12pt !important;
            }

            /* Formal Peserta Table */
            .peserta-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              page-break-inside: avoid;
            }
            .peserta-table th, .peserta-table td {
              border: 1px solid black !important;
              padding: 8px 10px;
              font-size: 11pt !important;
              color: #000 !important;
            }
            .peserta-table th { background: transparent !important; font-weight: bold !important; text-align: center !important; }

            /* TTD Area yang Sempurna */
            .ttd-area {
              display: flex !important;
              justify-content: space-between !important;
              margin-top: 70px !important;
              page-break-inside: avoid !important;
            }
            .ttd-box { width: 45%; text-align: center !important; color: #000 !important; }
            .ttd-label { font-size: 12pt !important; margin-bottom: 90px !important; }
            .ttd-name { font-size: 12pt !important; font-weight: bold !important; text-decoration: underline !important; }
            .ttd-nip { font-size: 11pt !important; margin-top: 3px !important; }

            .print-footer {
              margin-top: 50px;
              padding-top: 10px;
              border-top: 1px solid #000;
              font-size: 10pt !important;
              text-align: center;
              font-style: italic;
              color: #000 !important;
            }
          }
        `}</style>
      </Head>

      <button className="fab-print" onClick={handlePrint}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Cetak Laporan Resmi
      </button>

      <div className="document-container">
        {/* ================= HEADER ================= */}
        <div className="main-title-wrap">
          {/* Screen Only Badge */}
          <div className="screen-only badge-top">Notulen Rapat</div>
          <div className="screen-only doc-title">{cleanAiText(data.judul)}</div>

          {/* Print Only Title */}
          <div className="print-only print-title">NOTULEN RAPAT</div>
          <div className="print-only print-subtitle">{cleanAiText(data.judul)}</div>
        </div>

        {/* ================= INFORMASI RAPAT ================= */}
        <div className="section-card">
          <div className="screen-only section-header">📌 Detail Kegiatan</div>
          
          {/* Mode Layar (Grid) */}
          <div className="screen-only info-grid">
            <div className="info-item">
              <span className="info-label">Tanggal</span>
              <span className="info-value">
                {data.tanggal ? format(parseISO(data.tanggal), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Waktu</span>
              <span className="info-value">
                {data.waktu_mulai || '-'} {data.waktu_selesai ? ` - ${data.waktu_selesai} WITA` : ' WITA'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Tempat</span>
              <span className="info-value">{cleanAiText(data.tempat) || '-'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Pimpinan Rapat</span>
              <span className="info-value">{cleanAiText(data.pimpinan_rapat) || '-'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Notulis</span>
              <span className="info-value">{cleanAiText(data.notulis) || '-'}</span>
            </div>
          </div>

          {/* Mode Cetak (Tabel Formal) */}
          <table className="print-only info-table-print">
            <tbody>
              <tr>
                <td className="it-label">Hari, Tanggal</td>
                <td className="it-colon">:</td>
                <td className="it-value">{data.tanggal ? format(parseISO(data.tanggal), 'EEEE', { locale: idLocale }) + ', ' + formatDate(data.tanggal) : '-'}</td>
              </tr>
              <tr>
                <td className="it-label">Waktu</td>
                <td className="it-colon">:</td>
                <td className="it-value">{data.waktu_mulai || '-'} {data.waktu_selesai ? ` s.d. ${data.waktu_selesai} WITA` : ' WITA'}</td>
              </tr>
              <tr>
                <td className="it-label">Tempat</td>
                <td className="it-colon">:</td>
                <td className="it-value">{cleanAiText(data.tempat) || '-'}</td>
              </tr>
              <tr>
                <td className="it-label">Pimpinan Rapat</td>
                <td className="it-colon">:</td>
                <td className="it-value">{cleanAiText(data.pimpinan_rapat) || '-'}</td>
              </tr>
              <tr>
                <td className="it-label">Notulis</td>
                <td className="it-colon">:</td>
                <td className="it-value">{cleanAiText(data.notulis) || '-'}</td>
              </tr>
              {data.agenda && (
                <tr>
                  <td className="it-label">Agenda</td>
                  <td className="it-colon">:</td>
                  <td className="it-value">{cleanAiText(data.agenda)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Agenda (Screen Only, print already has it in table) */}
        {data.agenda && (
          <div className="screen-only section-card">
            <div className="section-header">🎯 Agenda</div>
            <div className="content-text">{cleanAiText(data.agenda)}</div>
          </div>
        )}

        {/* ================= PESERTA ================= */}
        {pesertaList.length > 0 && (
          <div className="section-card">
            <div className="section-header">👥 Daftar Peserta</div>
            <table className="peserta-table">
              <thead>
                <tr>
                  <th style={{ width: '8%', textAlign: 'center' }}>No.</th>
                  <th style={{ width: '45%' }}>Nama</th>
                  <th style={{ width: '27%' }}>Jabatan</th>
                  <th className="print-only" style={{ width: '20%' }}>Tanda Tangan</th>
                </tr>
              </thead>
              <tbody>
                {pesertaList.map((p, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}.</td>
                    <td>{p}</td>
                    <td></td>
                    <td className="print-only"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ================= JALANNYA RAPAT ================= */}
        {data.isi_notulen && (
          <div className="section-card">
            <div className="section-header">📝 Pembahasan / Jalannya Rapat</div>
            <div className="content-text">{cleanAiText(data.isi_notulen)}</div>
          </div>
        )}

        {/* ================= KESIMPULAN ================= */}
        {data.kesimpulan && (
          <div className="section-card">
            <div className="section-header">✅ Kesimpulan</div>
            <div className="content-text">{cleanAiText(data.kesimpulan)}</div>
          </div>
        )}

        {/* ================= TINDAK LANJUT ================= */}
        {data.tindak_lanjut && (
          <div className="section-card">
            <div className="section-header">🚀 Tindak Lanjut</div>
            <div className="content-text">{cleanAiText(data.tindak_lanjut)}</div>
          </div>
        )}

        {/* ================= TANDA TANGAN (PRINT ONLY) ================= */}
        <div className="print-only ttd-area">
          <div className="ttd-box">
            <div className="ttd-label">Notulis,</div>
            <div className="ttd-name">{cleanAiText(data.notulis) || '_______________________'}</div>
            {data.notulis && <div className="ttd-nip">NIP. ________________________</div>}
          </div>
          <div className="ttd-box">
            <div className="ttd-label">Pimpinan Rapat,</div>
            <div className="ttd-name">{cleanAiText(data.pimpinan_rapat) || '_______________________'}</div>
            {data.pimpinan_rapat && <div className="ttd-nip">NIP. ________________________</div>}
          </div>
        </div>

        {/* ================= FOOTER CETAK ================= */}
        <div className="print-only print-footer">
          Digenerate oleh Smart System NotulenAI • ID Dokumen: {data.id} • {data.created_at ? formatDate(data.created_at) : ''}
        </div>
      </div>
    </>
  );
}
