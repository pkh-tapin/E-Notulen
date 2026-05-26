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
  
  const cleanData: any = { ...data };

  // SISTEM PEMBERSIHAN & AUTO-HEALING JSON DINAMIS
  for (const key in cleanData) {
    if (typeof cleanData[key] === 'string') {
      let val = cleanData[key];

      // Deteksi jika AI "kebocoran" mengirim JSON mentah (seperti di screenshot)
      if (val.trim().startsWith('{') && val.trim().endsWith('}')) {
        try {
          // Bersihkan markdown jika ada, lalu parse
          const parsed = JSON.parse(val.replace(/```json/gi, '').replace(/```/g, '').trim());
          
          // Auto-mapping berdasarkan key
          if (key === 'isi_notulen' && parsed.isi_notulen) val = parsed.isi_notulen;
          if (key === 'judul' && parsed.judul_saran) val = parsed.judul_saran;
          if (key === 'kesimpulan' && parsed.kesimpulan) val = parsed.kesimpulan;
          if (key === 'tindak_lanjut' && parsed.tindak_lanjut) val = parsed.tindak_lanjut;
        } catch (e) {
          // Abaikan jika bukan JSON valid, lanjutkan sebagai teks biasa
        }
      }

      // Hapus asterisk markdown (*), potong string jika lebih dari 49,000 karakter (Batas Google Sheets 50k)
      val = val.replace(/\*/g, '').trim();
      if (val.length > 49000) {
         val = val.substring(0, 49000) + '\n\n[Dipotong otomatis: Melebihi batas sel database]';
      }
      cleanData[key] = val;
    }
  }
  
  cleanData.status = cleanData.status || 'draft';
  cleanData.updated_at = new Date().toISOString();

  // MODE UPDATE
  if (cleanData.id) {
    const rows = await sheet.getRows();
    const row = rows.find((r: any) => r.get('id') === cleanData.id);
    if (row) {
      SHEET_HEADERS.forEach(header => {
        if (cleanData[header] !== undefined) {
          if (typeof row.set === 'function') {
            row.set(header, cleanData[header]); 
          } else {
            row[header] = cleanData[header]; 
          }
        }
      });
      await row.save();
      return cleanData;
    }
  }
  
  // MODE CREATE
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
