import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
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
  notulis: string;
  peserta: string;
  agenda: string;
  isi_notulen: string;
  kesimpulan: string;
  tindak_lanjut: string;
  status: string;
  created_at: string;
}

export default function LihatNotulen() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<Notulen | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  // Fitur Pintar: Salin Semua Teks Notulen dengan Format Rapi
  const handleCopyText = () => {
    if (!data) return;
    
    const textToCopy = `
NOTULEN RAPAT: ${data.judul}
=========================================
Hari, Tanggal : ${data.tanggal ? format(parseISO(data.tanggal), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}
Waktu         : ${data.waktu_mulai || '-'} s.d. ${data.waktu_selesai || '-'} WIB
Tempat        : ${data.tempat || '-'}
Pimpinan      : ${data.pimpinan_rapat || '-'}
Notulis       : ${data.notulis || '-'}

AGENDA:
${data.agenda || '-'}

PESERTA:
${data.peserta ? data.peserta.split(/[\n,]+/).map((p, i) => `${i + 1}. ${p.trim()}`).join('\n') : '-'}

JALANNYA RAPAT:
${data.isi_notulen || '-'}

KESIMPULAN:
${data.kesimpulan || '-'}

TINDAK LANJUT:
${data.tindak_lanjut || '-'}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500); // Reset tulisan copy setelah 2.5 detik
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1e1b4b' }}>
        <p style={{ color: '#c4b5fd', fontSize: '1.2rem', fontWeight: '500', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>Memuat Data Presentasi...</p>
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

  const pesertaList = data.peserta ? data.peserta.split(/[\n,]+/).map(p => p.trim()).filter(Boolean) : [];

  return (
    <>
      <Head>
        <title>Lihat Notulen — {data.judul}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

          body { 
            margin: 0; 
            padding: 0; 
            background: linear-gradient(135deg, #0f172a 0%, #312e81 100%);
            background-attachment: fixed;
            font-family: 'Inter', sans-serif;
            color: #f3f4f6;
          }
          
          .presentation-container {
            max-width: 900px;
            margin: 2rem auto;
            padding: 0 1rem;
          }

          /* Glassmorphism Cards */
          .glass-panel {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            overflow: hidden;
          }

          .header-hero {
            padding: 3rem 2rem;
            text-align: center;
            background: linear-gradient(to bottom, rgba(79, 70, 229, 0.2), transparent);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .badge-top {
            display: inline-block;
            padding: 8px 20px;
            background: rgba(139, 92, 246, 0.2);
            color: #c4b5fd;
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 50px;
            font-size: 0.85rem;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 1.5rem;
          }

          .doc-title { 
            font-size: 2.2rem; 
            font-weight: 800; 
            line-height: 1.3; 
            text-wrap: balance;
            background: linear-gradient(to right, #fff, #c4b5fd);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          /* Action Bar */
          .action-bar {
            display: flex;
            justify-content: center;
            gap: 15px;
            padding: 1.5rem;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .btn-action {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
          }

          .btn-copy {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
          }
          .btn-copy:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5); }

          .btn-print {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          .btn-print:hover { background: rgba(255, 255, 255, 0.2); }

          /* Content Sections */
          .content-wrapper { padding: 2rem; }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 3rem;
          }

          .info-card {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .info-label { font-size: 0.8rem; color: #a78bfa; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; }
          .info-value { font-size: 1.1rem; font-weight: 600; color: #fff; }

          .section-block {
            margin-bottom: 2.5rem;
            background: rgba(0, 0, 0, 0.15);
            border-radius: 16px;
            padding: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.03);
          }

          .section-title {
            font-size: 1.2rem;
            color: #c4b5fd;
            font-weight: 700;
            margin-bottom: 1.2rem;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .section-title-icon {
            background: rgba(139, 92, 246, 0.2);
            padding: 6px;
            border-radius: 8px;
            display: flex;
          }

          .content-text {
            font-size: 1.05rem;
            line-height: 1.8;
            color: #e5e7eb;
            white-space: pre-line;
            user-select: auto; /* Memastikan teks mudah di-block/copy */
          }

          .peserta-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 12px;
          }
          
          .peserta-item {
            background: rgba(255,255,255,0.05);
            padding: 10px 15px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid rgba(255,255,255,0.02);
          }

        `}</style>
      </Head>

      <div className="presentation-container">
        
        {/* Navigasi Kembali */}
        <Link href="/">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a78bfa', cursor: 'pointer', marginBottom: '20px', fontWeight: '600' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Kembali ke Dashboard
          </div>
        </Link>

        <div className="glass-panel">
          {/* Hero Header */}
          <div className="header-hero">
            <div className="badge-top">Tinjauan Notulen</div>
            <h1 className="doc-title">{data.judul}</h1>
          </div>

          {/* Action Bar (Copy & Print) */}
          <div className="action-bar">
            <button className="btn-action btn-copy" onClick={handleCopyText}>
              {copied ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Tersalin!
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Salin Semua Teks
                </>
              )}
            </button>
            <Link href={`/cetak/${data.id}`} target="_blank">
              <button className="btn-action btn-print">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Format Cetak Formal
              </button>
            </Link>
          </div>

          <div className="content-wrapper">
            {/* Info Grid Laporan */}
            <div className="info-grid">
              <div className="info-card">
                <div className="info-label">Tanggal Rapat</div>
                <div className="info-value">
                  {data.tanggal ? format(parseISO(data.tanggal), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}
                </div>
              </div>
              <div className="info-card">
                <div className="info-label">Waktu Rapat</div>
                <div className="info-value">
                  {data.waktu_mulai || '-'} s.d. {data.waktu_selesai || '-'} WIB
                </div>
              </div>
              <div className="info-card">
                <div className="info-label">Lokasi / Tempat</div>
                <div className="info-value">{data.tempat || '-'}</div>
              </div>
              <div className="info-card">
                <div className="info-label">Pimpinan Rapat</div>
                <div className="info-value">{data.pimpinan_rapat || '-'}</div>
              </div>
            </div>

            {/* Agenda */}
            {data.agenda && (
              <div className="section-block">
                <div className="section-title">
                  <div className="section-title-icon">🎯</div>
                  Agenda Rapat
                </div>
                <div className="content-text">{data.agenda}</div>
              </div>
            )}

            {/* Pembahasan / Isi */}
            {data.isi_notulen && (
              <div className="section-block">
                <div className="section-title">
                  <div className="section-title-icon">💬</div>
                  Jalannya Rapat / Pembahasan
                </div>
                <div className="content-text">{data.isi_notulen}</div>
              </div>
            )}

            {/* Kesimpulan */}
            {data.kesimpulan && (
              <div className="section-block" style={{ background: 'linear-gradient(to right, rgba(16, 185, 129, 0.1), rgba(0,0,0,0.15))', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <div className="section-title" style={{ color: '#34d399' }}>
                  <div className="section-title-icon" style={{ background: 'rgba(52, 211, 153, 0.2)' }}>✅</div>
                  Kesimpulan
                </div>
                <div className="content-text">{data.kesimpulan}</div>
              </div>
            )}

            {/* Tindak Lanjut */}
            {data.tindak_lanjut && (
              <div className="section-block" style={{ background: 'linear-gradient(to right, rgba(245, 158, 11, 0.1), rgba(0,0,0,0.15))', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                <div className="section-title" style={{ color: '#fbbf24' }}>
                  <div className="section-title-icon" style={{ background: 'rgba(251, 191, 36, 0.2)' }}>🚀</div>
                  Tindak Lanjut
                </div>
                <div className="content-text">{data.tindak_lanjut}</div>
              </div>
            )}

            {/* Daftar Peserta */}
            {pesertaList.length > 0 && (
              <div className="section-block">
                <div className="section-title">
                  <div className="section-title-icon">👥</div>
                  Daftar Hadir / Peserta
                </div>
                <div className="peserta-list">
                  {pesertaList.map((p, i) => (
                    <div key={i} className="peserta-item">
                      <div style={{ background: 'rgba(255,255,255,0.1)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '0.95rem' }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '30px', color: '#64748b', fontSize: '0.85rem' }}>
          ID Dokumen: {data.id} • Dibuat oleh Notulis: {data.notulis || '-'}
        </div>
      </div>
    </>
  );
}
