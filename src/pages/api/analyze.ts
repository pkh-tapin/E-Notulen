import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    // PROMPT DENGAN KALIBRASI HIERARKI KETAT (ANGKA -> ABJAD)
    const prompt = `Anda adalah Asisten Notulis Eksekutif untuk SDM PKH Tapin.
    Tugas Anda: Menganalisa mendalam, mengkategorikan topik, menghilangkan kalimat berulang, dan menyusun transkrip mentah menjadi laporan formal.

    ATURAN STRUKTUR HIERARKI MUTLAK (WAJIB DIPATUHI):
    1. POIN UTAMA: Gunakan penomoran angka standar biasa (Contoh: 1., 2., 3.) untuk setiap topik atau pembahasan besar.
    2. POIN TURUNAN (ANAK POIN): Jika poin utama memiliki detail, penjelasan, atau rincian di bawahnya, gunakan penomoran huruf abjad kecil bertingkat (Contoh: a., b., c.).
    3. LARANGAN SIMBOL: DILARANG KERAS menggunakan simbol asterisk/bintang (*), tebal (**), hashtag (#), strip (-), atau peluru bulat (•). Semua daftar harus berupa kombinasi Angka dan Huruf Abjad agar rapi.
    4. KESIMPULAN EKSEKUTIF: Wajib dibuat ringkas, padat, berupa poin penomoran angka murni (1., 2., 3.) yang langsung merangkum inti keputusan rapat.

    Agenda Kegiatan: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah Rapat: "${text}"
    
    KEMBALIKAN JAWABAN DALAM FORMAT JSON MURNI BERIKUT (TANPA MARKDOWN):
    {
      "ringkasan": [
        "1. [Kesimpulan ringkas poin kesatu]",
        "2. [Kesimpulan ringkas poin kedua]"
      ],
      "poin_penting": [
        "1. Pembahasan Mengenai Regulasi Baru\na. Detail rincian pertama tanpa menggunakan simbol bintang\nb. Detail rincian kedua yang memperjelas poin utama",
        "2. Evaluasi Kinerja Lapangan\na. Detail rincian evaluasi pertama\nb. Detail rincian evaluasi kedua"
      ],
      "tindak_lanjut": [
        "1. [Rencana tindakan kesatu]\na. Penanggung jawab atau timeline detail",
        "2. [Rencana tindakan kedua]"
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

    // Pembersihan total dari sisa-sisa karakter nakal jika AI melakukan kesalahan
    responseText = responseText.replace(/\*/g, '').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
