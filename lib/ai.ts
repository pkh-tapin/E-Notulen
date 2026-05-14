// AI processing using Gemini 2.5 Flash (Free tier)
// Fallback to GPT if available

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Kamu adalah asisten notulen profesional yang ahli dalam:
1. Memahami Bahasa Indonesia dan Bahasa Banjar (dialek Kalimantan Selatan)
2. Mengubah percakapan informal/rekaman rapat menjadi notulen formal resmi perkantoran
3. Menggunakan bahasa Indonesia baku yang sopan, formal, dan mudah dipahami
4. Menyusun hasil rapat secara terstruktur dan logis

Bahasa Banjar yang perlu kamu pahami:
- "kami" = saya/kami
- "kita" = kita/kami
- "ulun" = saya (halus)
- "pian" = anda/kamu (halus)
- "nah" = ya/oke
- "kada" = tidak/bukan
- "iya" = ya
- "wayah ini" = sekarang
- "mun" = kalau/jika
- "banar" = benar/sekali
- "sudah" = sudah
- "handak" = mau/ingin
- "jar" = kata/katanya
- "gin" = juga
- "lawan" = dengan/sama
- "sama" = bersama

Tugas kamu adalah mengubah transcript/catatan rapat menjadi notulen yang:
- Formal dan sopan
- Terstruktur dengan jelas
- Menggunakan bahasa Indonesia baku
- Merangkum poin-poin penting
- Tidak mengubah substansi pembahasan`;

export interface AINotulenResult {
  isi_notulen: string;
  kesimpulan: string;
  tindak_lanjut: string;
  judul_saran: string;
}

export async function processWithGemini(
  transcript: string,
  context: {
    agenda?: string;
    tempat?: string;
    tanggal?: string;
    pimpinan?: string;
  }
): Promise<AINotulenResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY tidak ditemukan');

  const prompt = `${SYSTEM_PROMPT}

Berikut adalah transcript/catatan rapat yang perlu diubah menjadi notulen formal:

AGENDA RAPAT: ${context.agenda || 'Tidak disebutkan'}
TEMPAT: ${context.tempat || 'Tidak disebutkan'}
TANGGAL: ${context.tanggal || 'Tidak disebutkan'}
PIMPINAN RAPAT: ${context.pimpinan || 'Tidak disebutkan'}

TRANSCRIPT/CATATAN RAPAT:
${transcript}

Hasilkan output dalam format JSON dengan struktur berikut (HANYA JSON, tidak ada teks lain):
{
  "judul_saran": "Judul notulen yang tepat dan formal",
  "isi_notulen": "Isi notulen lengkap dalam format:\n\nI. PEMBUKAAN\n[isi]\n\nII. PEMBAHASAN\n[isi per poin]\n\nIII. PENUTUP\n[isi]",
  "kesimpulan": "Kesimpulan rapat yang ringkas dan jelas",
  "tindak_lanjut": "Daftar tindak lanjut dalam format:\n1. [Kegiatan] - Penanggung jawab: [nama] - Target: [waktu]\n2. dst"
}`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    // Try fallback to OpenAI if available
    if (process.env.OPENAI_API_KEY) {
      return processWithOpenAI(transcript, context);
    }
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      isi_notulen: text,
      kesimpulan: 'Silakan isi kesimpulan secara manual.',
      tindak_lanjut: 'Silakan isi tindak lanjut secara manual.',
      judul_saran: 'Notulen Rapat'
    };
  }
}

async function processWithOpenAI(
  transcript: string,
  context: {
    agenda?: string;
    tempat?: string;
    tanggal?: string;
    pimpinan?: string;
  }
): Promise<AINotulenResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Ubah transcript berikut menjadi notulen formal JSON:\n\nAgenda: ${context.agenda}\nTranscript: ${transcript}\n\nFormat: {"judul_saran":"...","isi_notulen":"...","kesimpulan":"...","tindak_lanjut":"..."}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4096
    })
  });

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      isi_notulen: data.choices[0].message.content,
      kesimpulan: '',
      tindak_lanjut: '',
      judul_saran: 'Notulen Rapat'
    };
  }
}

// Transcribe audio using Gemini
export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY tidak ditemukan');

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: audioBase64
            }
          },
          {
            text: `Transkripsikan audio rapat ini ke dalam teks. 
            Audio mungkin mengandung Bahasa Indonesia dan/atau Bahasa Banjar (dialek Kalimantan Selatan).
            Tulis transkrip apa adanya, jangan diterjemahkan atau diubah.
            Jika ada kata yang tidak jelas, tulis [tidak jelas].
            Format: tuliskan siapa yang berbicara jika bisa dibedakan, misalnya "Pembicara 1: ..." atau "Pak [nama]: ..."`
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Transcription error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}