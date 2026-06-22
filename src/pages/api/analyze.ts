import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    // PROMPT DENGAN PROTEKSI DATA (ANTI-LOSS)
    const prompt = `Anda adalah asisten khusus untuk SDM PKH Tapin yang bertindak sebagai Notulis Rapat Resmi.
    Tugas Anda adalah merapikan, memperjelas, dan menstrukturkan transkrip mentah berikut menjadi dokumen formal.
    
    ATURAN MUTLAK:
    1. JANGAN MENGURANGI atau MENGHILANGKAN detail informasi apa pun dari transkrip asli (termasuk nama orang, nama lokasi, angka nominal, tanggal, singkatan, serta keputusan kecil).
    2. Perjelas kalimat yang rancu atau berbelit-belit menjadi bahasa Indonesia formal yang baku (EYD) tanpa mengubah substansi asli.
    3. Jika ada poin pembahasan yang panjang, urai menjadi anak poin berurutan yang informatif.

    Agenda Rapat Utama: ${agenda || 'Pembahasan Umum'}
    Transkrip Mentah: "${text}"
    
    WAJIB kembalikan jawaban dalam format JSON MURNI (tanpa tanda kutip tiga markdown, tanpa pengantar):
    {
      "ringkasan": "Tuliskan ringkasan eksekutif secara padat, jelas mencakup seluruh esensi input (1-2 paragraf pendek).",
      "poin_penting": ["Tuliskan seluruh poin pembahasan secara detail, perjelas bahasanya di sini minimal 3 poin atau lebih sesuai input asli"],
      "tindak_lanjut": ["Tuliskan detail rencana tindak lanjut beserta penanggung jawab atau timeline jika disebutkan"]
    }`;

    let responseText = "";

    // MESIN UTAMA: GEMINI 2.5 FLASH
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("Gemini API Key hilang");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
      console.log("✅ AI Engine: Gemini 2.5 Flash Berhasil");

    } catch (geminiError: any) {
      console.warn("⚠️ Gemini Gagal, Melompat ke OpenAI/ChatGPT...", geminiError.message);
      
      // MESIN PELAPIS: OPENAI GPT
      if (!process.env.OPENAI_API_KEY) throw new Error("Semua kunci AI tidak ditemukan.");

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });
      
      responseText = completion.choices[0].message.content || "";
      console.log("✅ AI Engine: OpenAI ChatGPT Berhasil");
    }

    responseText = responseText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    console.error("🚨 CRITICAL AI ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
