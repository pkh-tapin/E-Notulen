import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    const prompt = `Anda adalah Asisten Notulis Eksekutif yang SANGAT PATUH untuk SDM PKH Tapin.
    Tugas Anda HANYALAH merapikan catatan mentah menjadi notulen resmi tanpa merubah atau mengurangi substansi asli sedikitpun.

    ATURAN MUTLAK KESETIAAN & FORMAT:
    1. ZERO DATA LOSS: DILARANG KERAS membuang topik, nama, angka, atau detail sekecil apapun dari teks asli. JANGAN MENAMBAH OPINI. Hanya rapikan bahasanya dan hapus duplikasi.
    2. HIERARKI KETAT (PENTING):
       - Topik Utama WAJIB ditulis dengan angka standar (1., 2., 3.) dan HANYA BERUPA JUDUL SINGKAT/TOPIK.
       - Penjelasan/Detail panjang WAJIB ditaruh di bawahnya menggunakan huruf abjad (a., b., c.).
    3. ANTI SIMBOL: JANGAN PERNAH menggunakan simbol bintang (*), tebal (**), hashtag (#), atau peluru (•). 
    4. KESIMPULAN & RTL: Buat sangat ringkas dan to the point menggunakan penomoran angka (1., 2.).

    Agenda: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah Rapat: 
    "${text}"
    
    KEMBALIKAN DALAM FORMAT JSON ARRAY STRING:
    {
      "ringkasan": ["1. Kesimpulan satu", "2. Kesimpulan dua"],
      "poin_penting": [
        "1. [JUDUL TOPIK PERTAMA]", 
        "a. [Penjelasan detail topik pertama yang sudah dirapikan...]", 
        "b. [Detail lainnya...]",
        "2. [JUDUL TOPIK KEDUA]",
        "a. [Penjelasan...]"
      ],
      "tindak_lanjut": ["1. [Tindakan satu]", "2. [Tindakan dua]"]
    }`;

    let responseText = "";

    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("Key hilang");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (geminiError: any) {
      if (!process.env.OPENAI_API_KEY) throw new Error("Semua API mati.");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });
      responseText = completion.choices[0].message.content || "";
    }

    // PEMBERSIHAN MUTLAK DARI SIMBOL
    responseText = responseText.replace(/\*/g, '').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
