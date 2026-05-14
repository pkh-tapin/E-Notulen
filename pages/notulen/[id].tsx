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

  // Fungsi untuk merapikan teks: Hapus bintang, buat penomoran, dan rata kanan-kiri
  const formatContent = (text: string) => {
    if (!text) return '-';
    return text.split('\n').map((line, i) => {
      const cleanLine = line.replace(/^\s*[\*\-]\s*/, '').trim();
      if (!cleanLine) return <br key={i} />;
      if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
        return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <span>{i + 1}.</span>
          <span style={{ textAlign: 'justify' }}>{cleanLine}</span>
        </div>;
      }
      return <p key={i} style={{ textAlign: 'justify', margin: '0 0 10px 0' }}>{cleanLine}</p>;
    });
  };

  const handleCopyText = () => {
    if (!data) return;
    const textToCopy = `NOTULEN RAPAT: ${data.judul}\n\n` + 
      `Hari/Tgl: ${data.tanggal ? format(parseISO(data.tanggal), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}\n` +
      `Isi Notulen:\n${data.isi_notulen?.replace(/[\*\-]/g, '•')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) return <div style={{ background: '#0f172a', minHeight: '100vh' }} />;
  if (!data) return <div>Data tidak ada</div>;

  return (
    <>
      <Head>
        <title>{data.judul}</title>
        <style>{`
          body { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); font-family: 'Inter', sans-serif; color: #f3f4f6; margin: 0; }
          .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 2rem; max-width: 900px; margin: 2rem auto; }
          .section-title { color: #c4b5fd; font-weight: 700; font-size: 1.2rem; margin-bottom: 1rem; border-left: 4px solid #8b5cf6; padding-left: 12px; text-transform: uppercase; }
          .text-justify { text-align: justify; line-height: 1.8; color: #e5e7eb; }
          .btn-copy { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-weight: 600; }
        `}</style>
      </Head>

      <div style={{ padding: '20px' }}>
        <Link href="/"><button style={{ color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px' }}>← Dashboard</button></Link>
        
        <div className="glass-card">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{data.judul}</h1>
            <button className="btn-copy" onClick={handleCopyText}>{copied ? 'Tersalin!' : 'Salin Notulen'}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '2rem' }}>
            <div><label style={{ color: '#a78bfa', fontSize: '0.8rem' }}>TANGGAL</label><div style={{ fontWeight: '600' }}>{data.tanggal ? format(parseISO(data.tanggal), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}</div></div>
            <div><label style={{ color: '#a78bfa', fontSize: '0.8rem' }}>LOKASI</label><div style={{ fontWeight: '600' }}>{data.tempat || '-'}</div></div>
          </div>

          <div className="section-title">Isi Pembahasan</div>
          <div className="text-justify">{formatContent(data.isi_notulen)}</div>

          <div className="section-title">Kesimpulan</div>
          <div className="text-justify" style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '15px', borderRadius: '12px' }}>{formatContent(data.kesimpulan)}</div>

          <div className="section-title">Tindak Lanjut</div>
          <div className="text-justify" style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '15px', borderRadius: '12px' }}>{formatContent(data.tindak_lanjut)}</div>
        </div>
      </div>
    </>
  );
}
