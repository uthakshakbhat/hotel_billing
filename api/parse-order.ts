import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: 'The dish or drink name as spoken' },
            quantity: { type: SchemaType.NUMBER, description: 'How many, default 1 if not said' },
          },
          required: ['name', 'quantity'],
        },
      },
    },
    systemInstruction:
      'You transcribe spoken restaurant orders into structured items. Extract every distinct food/drink item mentioned along with its quantity. If no quantity is said for an item, use 1. Ignore filler words like "please", "and", "give me". Keep item names close to how they were spoken (do not translate or rename them) so they can be matched against a menu afterward.',
  });

  try {
    const result = await model.generateContent(text);
    const items = JSON.parse(result.response.text());
    return res.status(200).json({ items });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Could not parse order' });
  }
}