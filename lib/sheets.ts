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
  
  // ⚡ PROTEKSI CANGGIH: Sanitasi & Pembatasan Karakter Maksimal Sel Google Sheets (Max 50k)
  const cleanData: any = {};
  SHEET_HEADERS.forEach(header => {
    let value = data[header];
    
    if (value === undefined || value === null) {
      value = '';
    } else if (typeof value === 'object') {
      value = JSON.stringify(value);
    } else {
      value = String(value);
    }

    // Jika teks melebihi kapasitas Google Sheet (50.000 karakter), potong aman di 48.000 demi kestabilan
    if (value.length > 48000) {
      value = value.substring(0, 48000) + "\n...[Teks dipotong karena batas kapasitas Google Sheets]...";
    }
    
    cleanData[header] = value;
  });

  const rows = await sheet.getRows();
  // Cari berdasarkan ID jika mode edit/update
  const row = cleanData.id ? rows.find((r: any) => r.get('id') === cleanData.id) : null;

  if (row) {
    console.log(`📝 [SHEETS] Memperbarui Baris Data ID: ${cleanData.id}`);
    cleanData.updated_at = new Date().toISOString();
    
    // Sinkronisasi data ke sel secara presisi (Mendukung v3 & v4 library)
    SHEET_HEADERS.forEach(header => {
      if (header !== 'id' && header !== 'created_at') {
        if (typeof row.set === 'function') {
          row.set(header, cleanData[header]);
        } else {
          row[header] = cleanData[header];
        }
      }
    });
    
    await row.save();
    return cleanData;
  } else {
    console.log(`➕ [SHEETS] Menambahkan Baris Baru`);
    // Buat parameter default jika data baru
    cleanData.id = cleanData.id || `NTL-${Date.now()}`;
    cleanData.created_at = new Date().toISOString();
    cleanData.updated_at = new Date().toISOString();
    
    await sheet.addRow(cleanData);
    return cleanData;
  }
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
