import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEET_HEADERS = [
  'id', 'judul', 'tanggal', 'waktu_mulai', 'waktu_selesai',
  'tempat', 'pimpinan_rapat', 'notulis', 'peserta',
  'agenda', 'isi_notulen', 'kesimpulan', 'tindak_lanjut',
  'status', 'created_at', 'updated_at', 'raw_transcript'
];

let docCache: any = null;

async function getDoc() {
  if (docCache) return docCache;
  
  // PERBAIKAN KRUSIAL UNTUK VERCEL: 
  // 1. Mengubah literal \n menjadi newline asli
  // 2. Menghapus tanda kutip ganda (") di awal dan akhir yang sering merusak key di Vercel
  // 3. Menghapus spasi kosong dengan trim()
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim()
    : '';

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  docCache = doc;
  return doc;
}

export async function getAllNotulen() {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  const rows = await sheet.getRows();
  return rows.map((row: any) => row.toObject());
}

export async function saveNotulen(data: any) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  
  if (data.id) {
    const rows = await sheet.getRows();
    const row = rows.find((r: any) => r.get('id') === data.id);
    if (row) {
      Object.assign(row, { ...data, updated_at: new Date().toISOString() });
      await row.save();
      return data;
    }
  }
  
  const newId = `NTL-${Date.now()}`;
  const record = { ...data, id: newId, created_at: new Date().toISOString(), status: data.status || 'draft' };
  await sheet.addRow(record);
  return record;
}

export async function getNotulenByDate(date: string) {
  const doc = await getDoc();
  // Gunakan fallback addSheet agar tidak error jika sheet belum ada
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  const rows = await sheet.getRows();
  
  // Filter data berdasarkan kolom 'tanggal'
  const filteredRows = rows.filter((r: any) => r.get('tanggal') === date);
  return filteredRows.map((row: any) => row.toObject());
}

export async function deleteNotulen(id: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'];
  
  if (!sheet) return false; // Jika sheet tidak ada, batalkan
  
  const rows = await sheet.getRows();
  // Cari baris berdasarkan ID
  const row = rows.find((r: any) => r.get('id') === id);
  
  if (row) {
    await row.delete(); // Hapus baris dari Google Sheets
    return true;
  }
  
  return false;
}
