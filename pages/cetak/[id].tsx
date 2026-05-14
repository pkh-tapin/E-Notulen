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
  const [orgName, setOrgName] = useState('PEMERINTAH KOTA/KABUPATEN');
  const [deptName, setDeptName] = useState('DINAS / INSTANSI');
  const [showConfig, setShowConfig] = useState(true);

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
    setShowConfig(false);
    setTimeout(() => window.print(), 200);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9fafb' }}>
        <p style={{ color: '#6b7280' }}>Memuat...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Notulen tidak ditemukan</p>
      </div>
    );
  }

  const pesertaList = data.peserta ? data.peserta.split(/[\n,]+/).map(p => p.trim()).filter(Boolean) : [];

  return (
    <>
      <Head>
        <title>Cetak Notulen — {data.judul}</title>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');

          @media print {
            .no-print { display: none !important; }
            body { margin: 0; padding: 0; }
            .print-page { 
              margin: 0; 
              padding: 2.5cm 3cm 2cm 3cm;
              box-shadow: none !important;
              min-height: auto;
            }
          }
          
          @media screen {
            body { background: #e5e7eb; }
            .print-page {
              max-width: 21cm;
              margin: 2rem auto;
              padding: 2.5cm 3cm 2cm 3cm;
              background: white;
              box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            }
          }

          .print-page {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
          }

          .kop-surat {
            border-bottom: 3px double #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 20px;
          }

          .kop-logo {
            width: 80px;
            height: 80px;
            border: 2px solid #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24pt;
            font-weight: bold;
            flex-shrink: 0;
          }

          .kop-text { text-align: center; flex: 1; }
          .kop-org { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .kop-dept { font-size: 13pt; font-weight: bold; text-transform: uppercase; }
          .kop-alamat { font-size: 9pt; margin-top: 3px; }

          .notulen-title {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            border: 2px solid #000;
            padding: 8px 20px;
            margin: 20px auto;
            display: inline-block;
          }

          .title-wrap {
            text-align: center;
            margin-bottom: 20px;
          }

          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          .info-table td {
            padding: 4px 8px;
            vertical-align: top;
            font-size: 11pt;
          }

          .info-table .label { width: 35%; font-weight: 500; }
          .info-table .colon { width: 3%; }
          .info-table .value { width: 62%; }

          .section-title {
            font-size: 12pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 20px 0 8px 0;
            border-bottom: 1px solid #000;
            padding-bottom: 4px;
          }

          .content-text {
            text-align: justify;
            font-size: 11pt;
            line-height: 1.8;
            white-space: pre-line;
          }

          .peserta-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11pt;
            margin-top: 8px;
          }

          .peserta-table th {
            background: #f3f4f6;
            border: 1px solid #666;
            padding: 5px 10px;
            font-weight: bold;
            text-align: center;
          }

          .peserta-table td {
            border: 1px solid #666;
            padding: 5px 10px;
          }

          .ttd-area {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 40px;
          }

          .ttd-box { text-align: center; }
          .ttd-label { font-size: 11pt; margin-bottom: 60px; }
          .ttd-name { font-size: 11pt; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; display: inline-block; min-width: 160px; }
          .ttd-nip { font-size: 10pt; margin-top: 2px; }
        `}</style>
      </Head>

      {/* Config Panel - screen only */}
      {showConfig && (
        <div className="no-print" style={{ background: '#1e40af', padding: '16px', color: 'white' }}>
          <div style={{ maxWidth: '21cm', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', opacity: 0.8 }}>Nama Organisasi/Pemerintah</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: 'none', fontSize: '13px', width: '280px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', opacity: 0.8 }}>Nama Dinas/Instansi</label>
              <input value={deptName} onChange={e => setDeptName(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: 'none', fontSize: '13px', width: '280px' }} />
            </div>
            <button onClick={handlePrint}
              style={{ padding: '8px 20px', background: 'white', color: '#1e40af', borderRadius: '4px', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
              🖨️ Cetak Sekarang
            </button>
          </div>
        </div>
      )}

      <div className="print-page">
        {/* KOP SURAT */}
        <div className="kop-surat">
          <div className="kop-logo">🏛️</div>
          <div className="kop-text">
            <div className="kop-org">{orgName}</div>
            <div className="kop-dept">{deptName}</div>
            <div className="kop-alamat">
              Jl. [Alamat Kantor], Telp. (0511) XXXXXXX, Fax. (0511) XXXXXXX
            </div>
          </div>
        </div>

        {/* JUDUL */}
        <div className="title-wrap">
          <div className="notulen-title">NOTULEN RAPAT</div>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '8px' }}>{data.judul}</div>
        </div>

        {/* INFO RAPAT */}
        <table className="info-table">
          <tbody>
            <tr>
              <td className="label">Hari, Tanggal</td>
              <td className="colon">:</td>
              <td className="value">
                {data.tanggal ? format(parseISO(data.tanggal), 'EEEE', { locale: idLocale }) + ', ' + formatDate(data.tanggal) : '-'}
              </td>
            </tr>
            <tr>
              <td className="label">Waktu</td>
              <td className="colon">:</td>
              <td className="value">
                {data.waktu_mulai || '-'}
                {data.waktu_selesai ? ` s.d. ${data.waktu_selesai} WIB` : ' WIB'}
              </td>
            </tr>
            <tr>
              <td className="label">Tempat</td>
              <td className="colon">:</td>
              <td className="value">{data.tempat || '-'}</td>
            </tr>
            <tr>
              <td className="label">Pimpinan Rapat</td>
              <td className="colon">:</td>
              <td className="value">{data.pimpinan_rapat || '-'}</td>
            </tr>
            <tr>
              <td className="label">Notulis</td>
              <td className="colon">:</td>
              <td className="value">{data.notulis || '-'}</td>
            </tr>
            {data.agenda && (
              <tr>
                <td className="label">Agenda</td>
                <td className="colon">:</td>
                <td className="value">{data.agenda}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* PESERTA */}
        {pesertaList.length > 0 && (
          <>
            <div className="section-title">Peserta Rapat</div>
            <table className="peserta-table">
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>No.</th>
                  <th style={{ width: '50%' }}>Nama</th>
                  <th style={{ width: '27%' }}>Jabatan</th>
                  <th style={{ width: '15%' }}>Tanda Tangan</th>
                </tr>
              </thead>
              <tbody>
                {pesertaList.map((p, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}.</td>
                    <td>{p}</td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ISI NOTULEN */}
        {data.isi_notulen && (
          <>
            <div className="section-title">Jalannya Rapat</div>
            <div className="content-text">{data.isi_notulen}</div>
          </>
        )}

        {/* KESIMPULAN */}
        {data.kesimpulan && (
          <>
            <div className="section-title">Kesimpulan</div>
            <div className="content-text">{data.kesimpulan}</div>
          </>
        )}

        {/* TINDAK LANJUT */}
        {data.tindak_lanjut && (
          <>
            <div className="section-title">Tindak Lanjut</div>
            <div className="content-text">{data.tindak_lanjut}</div>
          </>
        )}

        {/* TTD */}
        <div className="ttd-area" style={{ marginTop: '50px' }}>
          <div className="ttd-box">
            <div className="ttd-label">Notulis,</div>
            <div className="ttd-name">{data.notulis || '_______________________'}</div>
            <div className="ttd-nip">NIP. ________________________</div>
          </div>
          <div className="ttd-box">
            <div className="ttd-label">Pimpinan Rapat,</div>
            <div className="ttd-name">{data.pimpinan_rapat || '_______________________'}</div>
            <div className="ttd-nip">NIP. ________________________</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1px solid #ccc', fontSize: '9pt', color: '#666', textAlign: 'center' }}>
          Dokumen ini digenerate oleh NotulenAI • ID: {data.id} • {data.created_at ? formatDate(data.created_at) : ''}
        </div>
      </div>
    </>
  );
}
