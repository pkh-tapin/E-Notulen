import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    // PROMPT ANALISA MENDALAM (DEEP PARSING & CLEANING)
    const prompt = `Anda adalah Asisten Notulis Senior ahli untuk SDM PKH Tapin.
    Tugas Anda: Menganalisa mendalam, merapikan, dan menstrukturkan transkrip mentah yang seringkali berulang, typo, atau tidak fokus.

    ATURAN KETAT (WAJIB DIPATUHI):
    1. ANTI MARKDOWN: DILARANG KERAS menggunakan karakter seperti bintang (*), hashtag (#), atau tebal ganda (**). Gunakan penomoran angka biasa (1., 2., 3.) atau huruf (a., b., c.).
    2. ANALISA & KATEGORIKAN: Gabungkan pembahasan yang berulang atau memiliki makna sama menjadi satu poin utuh. Kelompokkan berdasarkan kategori topik agar sangat sistematis.
    3. PERBAIKI KONTEKS: Lengkapi kata-kata yang terpotong/typo sesuai konteks rasional. Pastikan tidak ada informasi krusial (nama, tanggal, angka, keputusan) yang terbuang.
    4. KESIMPULAN: Ringkasan eksekutif WAJIB dibuat SANGAT PADAT dan RINGKAS dalam bentuk poin-poin bernomor (point-to-point).

    Agenda Rapat: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah: "${text}"
    
    WAJIB kembalikan dalam format JSON MURNI:
    {
      "ringkasan": "1. [kesimpulan padat pertama]\n2. [kesimpulan padat kedua]",
      "poin_penting": ["1. [Topik A]: Penjelasan mendalam yang sudah dirapikan...", "2. [Topik B]: Penjelasan mendalam..."],
      "tindak_lanjut": ["1. [Tindakan A]", "2. [Tindakan B]"]
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

    // Pembersihan ekstraksi JSON
    responseText = responseText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
