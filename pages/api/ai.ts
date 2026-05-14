import type { NextApiRequest, NextApiResponse } from 'next';
import { processWithGemini, transcribeAudio } from '../../lib/ai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // for audio files
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  const { action } = req.query;

  try {
    // Transcribe audio to text
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'Data audio diperlukan' });
      }
      const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
      return res.status(200).json({ transcript });
    }

    // Process transcript to formal notulen
    if (action === 'process') {
      const { transcript, agenda, tempat, tanggal, pimpinan } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: 'Transcript diperlukan' });
      }
      const result = await processWithGemini(transcript, { agenda, tempat, tanggal, pimpinan });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Action tidak valid. Gunakan: transcribe atau process' });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan AI' });
  }
}