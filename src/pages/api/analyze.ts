import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    // PROMPT KETAT: HIGH FIDELITY (KESETIAAN MUTLAK PADA TEKS ASLI)
    const prompt = `Anda adalah Asisten Notulis Eksekutif yang SANGAT PATUH untuk SDM PKH Tapin.
    Tugas Anda HANYALAH merapikan catatan mentah/transkrip lisan menjadi notulen resmi tanpa merubah substansi asli sedikitpun.

    ATURAN MUTLAK (JIKA DILANGGAR ANDA GAGAL):
    1. KESETIAAN PADA DATA ASLI (ZERO DATA LOSS): DILARANG KERAS membuang, mengarang, atau menghilangkan poin/topik sekecil apapun dari teks asli. Semua nama, angka, lokasi, masalah, dan keputusan WAJIB ADA.
    2. HANYA MERAPIKAN: Tugas Anda hanya menghapus kalimat yang berulang (duplikat), memperbaiki kata yang typo, dan mengubah bahasa lisan yang berantakan menjadi kalimat bahasa Indonesia baku (EYD) yang mudah dibaca. JANGAN menambah informasi dari luar teks.
    3. KESIMPULAN & TINDAK LANJUT: Ringkasan WAJIB dibuat sangat padat, singkat, dan *to the point*. Tindak lanjut harus murni diambil dari rencana/instruksi yang ada di dalam teks asli (jangan mengarang tugas baru).
    4. STRUKTUR HIERARKI ANGKA & ABJAD:
       - Topik utama gunakan nomor angka standar (1., 2., 3.).
       - Penjelasan/rincian di bawah topik utama gunakan huruf abjad kecil (a., b., c.).
    5. ANTI SIMBOL: JANGAN PERNAH menggunakan simbol bintang (*), tebal (**), hashtag (#), strip (-), atau peluru (•) di bagian manapun.

    Agenda Kegiatan: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah Rapat (Ini adalah acuan SATU-SATUNYA): 
    "${text}"
    
    KEMBALIKAN DALAM FORMAT JSON MURNI BERIKUT:
    {
      "ringkasan": [
        "1. [Kesimpulan sangat padat dan singkat dari topik pertama]",
        "2. [Kesimpulan sangat padat dari topik lainnya]"
      ],
      "poin_penting": [
        "1. [Nama Topik Pertama Sesuai Teks Asli]\na. [Isi penjelasan topik yang sudah dirapikan bahasanya]\nb. [Isi penjelasan lainnya tanpa ada yang dibuang]",
        "2. [Nama Topik Kedua]\na. [Penjelasan...]"
      ],
      "tindak_lanjut": [
        "1. [Tindakan spesifik yang disebutkan di teks asli]",
        "2. [Tindakan lainnya]"
      ]
    }`;

    let responseText = "";

    // MESIN UTAMA: GEMINI 2.5 FLASH
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("Gemini API Key hilang");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (geminiError: any) {
      console.warn("⚠️ Melompat ke OpenAI/ChatGPT...", geminiError.message);
      
      // MESIN PELAPIS: OPENAI GPT
      if (!process.env.OPENAI_API_KEY) throw new Error("Kunci AI tidak ditemukan.");

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });
      responseText = completion.choices[0].message.content || "";
    }

    // PEMBERSIHAN OTOMATIS: Membunuh semua simbol Markdown jika AI membangkang
    responseText = responseText.replace(/\*/g, '').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
