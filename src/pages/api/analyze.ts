import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { text, agenda } = req.body;
    if (!text) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

    const prompt = `Anda adalah notulis rapat. Rapikan transkrip berikut. 
    Agenda: ${agenda || 'Pembahasan umum'}. 
    Transkrip: "${text}"
    
    WAJIB jawab dalam format JSON MURNI (tanpa tanda kutip tiga, tanpa markdown, tanpa kata pengantar):
    {
      "ringkasan": "...",
      "poin_penting": ["...", "..."],
      "tindak_lanjut": ["...", "..."]
    }`;

    let responseText = "";

    // MESIN UTAMA: GEMINI 2.5 FLASH (Sesuai Komando Anda)
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("Gemini API Key hilang");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
      console.log("✅ SUKSES: Menggunakan Gemini 2.5 Flash");

    } catch (geminiError: any) {
      console.warn("⚠️ Gemini 2.5 Flash Gagal (Melompat ke OpenAI...):", geminiError.message);
      
      // MESIN PELAPIS: OPEN AI (GPT)
      if (!process.env.OPENAI_API_KEY) throw new Error("Kunci OpenAI tidak ditemukan.");

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // atau "gpt-3.5-turbo"
        messages: [{ role: "user", content: prompt }],
      });
      
      responseText = completion.choices[0].message.content || "";
      console.log("✅ SUKSES: Menggunakan OpenAI (ChatGPT)");
    }

    responseText = responseText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    const aiStructured = JSON.parse(responseText);
    return res.status(200).json({ success: true, data: aiStructured });

  } catch (error: any) {
    console.error("🚨 KEDUA MESIN GAGAL:", error.message);
    return res.status(500).json({ error: "Sistem AI Gagal. Jika ini OpenAI, pastikan saldo API Anda terisi (Bukan Error Code 429)." });
  }
}