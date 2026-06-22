import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    // PROMPT DOKTRIN KESETIAAN MUTLAK (NAMA TOKOH & ANTI BUANG DATA)
    const prompt = `Anda adalah Asisten Notulis Eksekutif di SDM PKH Tapin. 
    Tugas Anda: Merapikan catatan mentah/transkrip suara menjadi notulensi. PATOKAN MUTLAK ADALAH TEKS ASLI.

    DOKTRIN KESETIAAN DATA (WAJIB DIPATUHI 100%):
    1. HARGA MATI NAMA PEMATERI: JANGAN PERNAH menghapus nama orang! Jika teks asli menyebutkan "Bapak X menyampaikan..." atau "Ibu Y menanyakan...", Anda WAJIB MENCANTUMKAN nama Bapak/Ibu tersebut di dalam rincian Anda.
    2. PENANGANAN PENDAPAT GANDA/SAMA: Jika ada tokoh yang menyampaikan hal yang sama/mirip, JANGAN DIBUANG. Tuliskan dengan rapi, contoh: "Sejalan dengan penyampaian Bapak A, Ibu B menegaskan kembali bahwa..."
    3. DILARANG BERSPEKULASI: JANGAN menambahkan opini, kata-kata yang tidak ada konteksnya di teks asli, atau membuang data. Kunci pemahaman Anda sama persis dengan apa yang diketik/direkam.
    4. TUGAS ANDA HANYA MERAPIKAN: Rapikan bahasa lisannya, perbaiki typo, dan perjelas kalimat yang rumpang tanpa keluar dari konteks.

    ATURAN FORMAT VISUAL (WAJIB DIIKUTI):
    - POIN UTAMA (Angka): Gunakan (1., 2., 3.). WAJIB HURUF KAPITAL SEMUA untuk judul poinnya.
    - ANAK POIN (Abjad): Gunakan (a., b., c.). WAJIB beri awalan 4 spasi (    a.) agar menjorok ke dalam (alenia).
    - ANTI SIMBOL: Dilarang keras memakai bintang (*), tebal (**), hashtag (#), atau peluru (•).
    - Kesimpulan & Tindak Lanjut dibuat sangat ringkas, padat, jelas menggunakan angka murni.

    Agenda: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah Rapat: 
    "${text}"
    
    KEMBALIKAN DALAM FORMAT JSON ARRAY STRING:
    {
      "ringkasan": ["1. Kesimpulan satu", "2. Kesimpulan dua"],
      "poin_penting": [
        "1. [JUDUL TOPIK PERTAMA HURUF KAPITAL]", 
        "    a. Bapak X menyampaikan bahwa...", 
        "    b. Ibu Y menambahkan terkait...",
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

    // Pembersihan Karakter Nakal
    responseText = responseText.replace(/\*/g, '').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
