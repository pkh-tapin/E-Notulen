import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    // PROMPT ZERO HALLUCINATION & FORMATTING KETAT
    const prompt = `Anda adalah Asisten Notulis Eksekutif yang SANGAT PATUH untuk SDM PKH Tapin.
    Tugas Anda HANYALAH merapikan catatan mentah menjadi notulen resmi. PATOKAN MUTLAK ADALAH TEKS ASLI.

    ATURAN MUTLAK KESETIAAN & FORMAT BARU (WAJIB DIIKUTI):
    1. ANTI BERSPEKULASI (ZERO HALLUCINATION): DILARANG KERAS menambah opini, mengarang fakta, atau membuang data (angka, nama, masalah, keputusan) sekecil apapun dari teks asli. Hanya rapikan bahasanya dan hapus duplikasi kata yang berulang.
    2. FORMAT POIN UTAMA (KAPITAL): 
       - Gunakan angka standar (1., 2., 3.).
       - WAJIB gunakan HURUF KAPITAL (BESAR) SELURUHNYA untuk judul poin utama.
       - Contoh: "1. EVALUASI KINERJA LAPANGAN"
    3. FORMAT ANAK POIN (MENJOROK/ALENIA):
       - Gunakan huruf abjad kecil (a., b., c.).
       - WAJIB beri awalan 4 spasi sebelum huruf agar teks menjorok ke dalam (alenia).
       - Contoh: "    a. Seluruh SDM PKH diwajibkan..."
    4. ANTI SIMBOL: JANGAN PERNAH menggunakan simbol bintang (*), tebal (**), hashtag (#), atau peluru (•). Hanya gunakan Angka, Spasi, dan Abjad.
    5. KESIMPULAN & RTL: Buat sangat ringkas dan padat.

    Agenda: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah Rapat: 
    "${text}"
    
    KEMBALIKAN DALAM FORMAT JSON ARRAY STRING (PERHATIKAN SPASI PADA ANAK POIN):
    {
      "ringkasan": ["1. Kesimpulan satu", "2. Kesimpulan dua"],
      "poin_penting": [
        "1. [JUDUL TOPIK PERTAMA HURUF KAPITAL]", 
        "    a. [Penjelasan detail topik pertama yang sudah dirapikan...]", 
        "    b. [Detail penjelasan lainnya...]",
        "2. [JUDUL TOPIK KEDUA HURUF KAPITAL]",
        "    a. [Penjelasan...]"
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

    // Ekstraksi dan Pembersihan Paksa Simbol Bintang
    responseText = responseText.replace(/\*/g, '').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
