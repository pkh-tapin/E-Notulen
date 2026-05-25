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
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  docCache = doc;
  return doc;
}

// Fungsi tingkat tinggi untuk membersihkan teks AI dari simbol markdown asterisks (**)
function sanitizeAiData(val: any): string {
  if (typeof val !== 'string') return val || '';
  return val.replace(/\*\*/g, '').trim();
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
  
  // Membersihkan seluruh field teks utama dari karakter bintang bawaan format AI
  const cleanData: Record<string, any> = {
    judul: sanitizeAiData(data.judul),
    tanggal: data.tanggal || '',
    waktu_mulai: data.waktu_mulai || '',
    waktu_selesai: data.waktu_selesai || '',
    tempat: sanitizeAiData(data.tempat),
    pimpinan_rapat: sanitizeAiData(data.pimpinan_rapat),
    notulis: sanitizeAiData(data.notulis),
    peserta: sanitizeAiData(data.peserta),
    agenda: sanitizeAiData(data.agenda),
    isi_notulen: sanitizeAiData(data.isi_notulen),
    kesimpulan: sanitizeAiData(data.kesimpulan),
    tindak_lanjut: sanitizeAiData(data.tindak_lanjut),
    raw_transcript: data.raw_transcript || '',
    status: data.status || 'draft' // Menjaga akurasi penentuan tombol Draft / Final dari client
  };

  if (data.id) {
    const rows = await sheet.getRows();
    const row = rows.find((r: any) => r.get('id') === data.id);
    if (row) {
      // Perbarukan baris data lama dengan data baru yang sudah bersih
      Object.assign(row, { 
        ...cleanData, 
        id: data.id, 
        created_at: data.created_at || row.get('created_at'),
        updated_at: new Date().toISOString() 
      });
      await row.save();
      return { ...cleanData, id: data.id };
    }
  }
  
  // Jika data baru, buat ID unik baru
  const newId = `NTL-${Date.now()}`;
  const record = { 
    ...cleanData, 
    id: newId, 
    created_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  };
  
  await sheet.addRow(record);
  return record;
}

export async function getNotulenByDate(date: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  const rows = await sheet.getRows();
  const filteredRows = rows.filter((r: any) => r.get('tanggal') === date);
  return filteredRows.map((row: any) => row.toObject());
}

export async function deleteNotulen(id: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'];
  if (!sheet) return false;
  
  const rows = await sheet.getRows();
  const row = rows.find((r: any) => r.get('id') === id);
  if (row) {
    await row.delete();
    return true;
  }
  return false;
}
