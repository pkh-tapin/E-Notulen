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

// Fungsi bantu untuk membersihkan teks hasil AI dari karakter bintang (*)
function cleanAiText(text: any) {
  if (typeof text !== 'string') return text;
  return text.replace(/\*/g, '');
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
  
  // Wajib Bersihkan bidang yang berpotensi dihasilkan oleh AI dari simbol markdown bintang
  const sanitizedData = {
    ...data,
    isi_notulen: cleanAiText(data.isi_notulen),
    kesimpulan: cleanAiText(data.kesimpulan),
    tindak_lanjut: cleanAiText(data.tindak_lanjut),
    judul: cleanAiText(data.judul),
    agenda: cleanAiText(data.agenda)
  };

  if (sanitizedData.id) {
    const rows = await sheet.getRows();
    const row = rows.find((r: any) => r.get('id') === sanitizedData.id);
    if (row) {
      Object.assign(row, { ...sanitizedData, updated_at: new Date().toISOString() });
      await row.save();
      return sanitizedData;
    }
  }
  
  const newId = `NTL-${Date.now()}`;
  const record = { ...sanitizedData, id: newId, created_at: new Date().toISOString(), status: sanitizedData.status || 'draft' };
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
