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

export async function getAllNotulen() {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  const rows = await sheet.getRows();
  return rows.map((row: any) => row.toObject());
}

export async function saveNotulen(data: any) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  
  // SISTEM PEMBERSIHAN DINAMIS
  const cleanData: any = { ...data };
  for (const key in cleanData) {
    if (typeof cleanData[key] === 'string') {
      // Hanya menghapus bintang markdown (*), spasi & enter (\n) tetap aman
      cleanData[key] = cleanData[key].replace(/\*/g, '').trim();
    }
  }
  
  cleanData.status = cleanData.status || 'draft';
  cleanData.updated_at = new Date().toISOString();

  // MODE UPDATE: JIKA ID SUDAH ADA (Misal AI dipanggil setelah data di-draft)
  if (cleanData.id) {
    const rows = await sheet.getRows();
    const row = rows.find((r: any) => r.get('id') === cleanData.id);
    if (row) {
      // FIX MUTLAK: Memaksa update sel satu per satu secara langsung (Support semua versi library)
      SHEET_HEADERS.forEach(header => {
        if (cleanData[header] !== undefined) {
          if (typeof row.set === 'function') {
            row.set(header, cleanData[header]); // Library v4
          } else {
            row[header] = cleanData[header]; // Library v3
          }
        }
      });
      
      await row.save();
      return cleanData;
    }
  }
  
  // MODE CREATE: JIKA DATA BARU
  cleanData.id = cleanData.id || `NTL-${Date.now()}`;
  cleanData.created_at = cleanData.created_at || new Date().toISOString();
  
  await sheet.addRow(cleanData);
  return cleanData;
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
