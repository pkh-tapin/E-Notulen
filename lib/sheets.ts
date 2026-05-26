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
  
  // SISTEM PEMBERSIHAN & PROKSI DATA DINAMIS (ANTI CRASH AI)
  const cleanData: any = {};
  
  SHEET_HEADERS.forEach(header => {
    let value = data[header];
    
    if (value === undefined || value === null) {
      cleanData[header] = '';
      return;
    }

    // Jika AI mengembalikan array (misal daftar peserta/agenda), konversi ke string berpoin
    if (Array.isArray(value)) {
      value = value.join(', ');
    } else if (typeof value === 'object') {
      value = JSON.stringify(value);
    }

    if (typeof value === 'string') {
      // Hapus asterisk markdown (*), jaga spasi dan enter tetap aman
      let cleanedStr = value.replace(/\*/g, '').trim();
      
      // PROTEKSI LIMIT GOOGLE SHEETS (Maks 50,000 karakter per sel)
      if (cleanedStr.length > 48000) {
        cleanedStr = cleanedStr.substring(0, 48000) + '\n\n[Teks dipotong otomatis oleh sistem karena melebihi batas kapasitas sel Google Sheets]';
      }
      cleanData[header] = cleanedStr;
    } else {
      cleanData[header] = String(value);
    }
  });
  
  cleanData.status = cleanData.status || 'draft';
  cleanData.updated_at = new Date().toISOString();

  // MODE UPDATE: JIKA ID SUDAH ADA
  if (cleanData.id) {
    const rows = await sheet.getRows();
    const row = rows.find((r: any) => r.get('id') === cleanData.id);
    if (row) {
      // Solusi update mutlak yang aman untuk semua versi google-spreadsheet
      SHEET_HEADERS.forEach(header => {
        try {
          if (typeof row.set === 'function') {
            row.set(header, cleanData[header]);
          } else {
            row[header] = cleanData[header];
          }
        } catch (e) {
          row[header] = cleanData[header];
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
