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
  
  // PERBAIKAN MUTLAK 1: Mencegah error "Cannot read properties of undefined (reading 'replace')"
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  const rawEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawSheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!rawPrivateKey || !rawEmail || !rawSheetId) {
    throw new Error("KONFIGURASI FATAL: Variabel .env untuk Google Sheets (Email, Private Key, atau Sheet ID) tidak ditemukan atau kosong!");
  }

  // Aman untuk menggunakan replace karena kita sudah memastikan nilainya berupa string
  const privateKey = typeof rawPrivateKey === 'string' 
    ? rawPrivateKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim()
    : '';

  const auth = new JWT({
    email: rawEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const doc = new GoogleSpreadsheet(rawSheetId, auth);
  await doc.loadInfo();
  docCache = doc;
  return doc;
}

export async function getAllNotulen() {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  const rows = await sheet.getRows();
  
  return rows.map((row: any) => {
    if (typeof row.toObject === 'function') {
      return row.toObject();
    }
    const obj: any = {};
    SHEET_HEADERS.forEach(header => {
      obj[header] = row.get ? row.get(header) : row[header];
    });
    return obj;
  });
}

export async function saveNotulen(data: any) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  
  const cleanData: any = {};
  
  // PERBAIKAN MUTLAK 2: Pengecekan ketat sebelum melakukan replace pada data string
  SHEET_HEADERS.forEach(key => {
    let val = data[key];
    if (val === undefined || val === null) {
      cleanData[key] = ''; 
    } else if (typeof val === 'string') {
      cleanData[key] = val.replace(/\*/g, '').trim(); 
    } else {
      cleanData[key] = String(val); 
    }
  });
  
  cleanData.status = cleanData.status || 'draft';
  cleanData.updated_at = new Date().toISOString();

  if (data.id) {
    const rows = await sheet.getRows();
    const row = rows.find((r: any) => (r.get ? r.get('id') : r.id) === data.id);
    
    if (row) {
      if (typeof row.assign === 'function') {
        row.assign(cleanData);
      } else {
        SHEET_HEADERS.forEach(header => {
          if (cleanData[header] !== undefined) {
            if (typeof row.set === 'function') {
              row.set(header, cleanData[header]); 
            } else {
              row[header] = cleanData[header]; 
            }
          }
        });
      }
      
      await row.save();
      return cleanData;
    }
  }
  
  cleanData.id = cleanData.id || `NTL-${Date.now()}`;
  cleanData.created_at = cleanData.created_at || new Date().toISOString();
  
  await sheet.addRow(cleanData);
  return cleanData;
}

export async function getNotulenByDate(date: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'] || await doc.addSheet({ title: 'Notulen', headerValues: SHEET_HEADERS });
  const rows = await sheet.getRows();
  
  const filteredRows = rows.filter((r: any) => (r.get ? r.get('tanggal') : r.tanggal) === date);
  return filteredRows.map((row: any) => {
    if (typeof row.toObject === 'function') return row.toObject();
    const obj: any = {};
    SHEET_HEADERS.forEach(header => { obj[header] = row.get ? row.get(header) : row[header]; });
    return obj;
  });
}

export async function deleteNotulen(id: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle['Notulen'];
  if (!sheet) return false;
  
  const rows = await sheet.getRows();
  const row = rows.find((r: any) => (r.get ? r.get('id') : r.id) === id);
  if (row) {
    await row.delete();
    return true;
  }
  return false;
}
