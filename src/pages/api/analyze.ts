import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    // PROMPT SUPER KETAT: ANTI MARKDOWN & WAJIB POIN
    const prompt = `Anda adalah Asisten Notulis Senior di SDM PKH Tapin.
    Tugas Anda: Menganalisa, mengkategorikan, membuang pengulangan, dan merapikan transkrip mentah. Lengkapi kata yang kurang berdasarkan konteks rasional.

    ATURAN MUTLAK (JIKA DILANGGAR SISTEM AKAN ERROR):
    1. ANTI MARKDOWN: DILARANG KERAS menggunakan simbol asterisk/bintang (*), hashtag (#), atau strip (-). 
    2. WAJIB PENOMORAN: Gunakan penomoran angka standar (1. 2. 3.) untuk setiap poin.
    3. KESIMPULAN: WAJIB berupa poin-poin sangat ringkas, padat, dan menohok. Jangan buat paragraf menggumpal.

    Agenda: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah: "${text}"
    
    KEMBALIKAN DALAM FORMAT JSON BERISI ARRAY STRING SEPERTI INI:
    {
      "ringkasan": ["1. [Kesimpulan padat 1]", "2. [Kesimpulan padat 2]"],
      "poin_penting": ["1. [Kategori/Topik A]: Penjelasan detail...", "2. [Kategori/Topik B]: Penjelasan detail..."],
      "tindak_lanjut": ["1. [Tindakan 1]", "2. [Tindakan 2]"]
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

    // PEMBERSIHAN TOTAL: Membunuh semua simbol bintang (*) jika AI masih bandel
    responseText = responseText.replace(/\*/g, '').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
