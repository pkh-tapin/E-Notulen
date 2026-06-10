import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { pdfBase64, fileName } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'Data PDF kosong' });

    // Memeriksa Kredensial Google
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error("🚨 DRIVE ERROR: Kredensial Google (Email/Private Key) tidak ada di .env");
      return res.status(500).json({ error: 'Konfigurasi Google Drive hilang.' });
    }

    // Autentikasi Tingkat Tinggi (Service Account)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Mengolah format kunci
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Membersihkan Teks Base64 dan Mengubahnya Menjadi File Fisik (Buffer)
    const cleanBase64 = pdfBase64.split(';base64,').pop();
    const buffer = Buffer.from(cleanBase64, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Metadata File (Nama & Folder Tujuan)
    const fileMetadata: any = { name: fileName || `Notulen_${Date.now()}.pdf` };
    
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
    }

    // Eksekusi Pengunggahan
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: { mimeType: 'application/pdf', body: stream },
      fields: 'id, webViewLink',
    });

    console.log("✅ PDF SUKSES DIUNGGAH KE DRIVE. ID:", file.data.id);
    return res.status(200).json({ success: true, link: file.data.webViewLink });

  } catch (error: any) {
    console.error("🚨 DRIVE UPLOAD FATAL ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
}