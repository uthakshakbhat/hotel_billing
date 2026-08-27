import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, SchemaType, type Tool } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MENU_CATEGORIES =
  'South Indian Breakfast, Evening Snacks, Seasonal, Flatbreads, Dosa, Combos, Hot Beverages, Cold Beverages, Occasional Dosas';

const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'add_cash_expense',
        description: 'Record a cash expense for today, e.g. buying vegetables, gas cylinder, repairs.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            description: { type: SchemaType.STRING, description: 'What the expense was for' },
            amount: { type: SchemaType.NUMBER, description: 'Amount in rupees' },
          },
          required: ['description', 'amount'],
        },
      },
      {
        name: 'add_employee_payment',
        description: 'Record a payment made to a staff member, e.g. salary or advance.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            employee_name: { type: SchemaType.STRING },
            amount: { type: SchemaType.NUMBER },
            note: { type: SchemaType.STRING, description: 'Optional note, e.g. advance, salary' },
          },
          required: ['employee_name', 'amount'],
        },
      },
      {
        name: 'add_menu_item',
        description: 'Add a new item to the restaurant menu.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING },
            price: { type: SchemaType.NUMBER },
            category: { type: SchemaType.STRING, description: `Must be one of exactly: ${MENU_CATEGORIES}` },
          },
          required: ['name', 'price', 'category'],
        },
      },
      {
        name: 'get_summary',
        description: 'Get income, expenses, and balance for a date range.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            from: { type: SchemaType.STRING, description: 'Start date YYYY-MM-DD' },
            to: { type: SchemaType.STRING, description: 'End date YYYY-MM-DD' },
          },
          required: ['from', 'to'],
        },
      },
    ],
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body ?? {};
  if (!message) return res.status(400).json({ error: 'Missing message' });

  const today = new Date().toISOString().split('T')[0];

  const model = genAI.getGenerativeModel({
    // 'gemini-flash-latest' is an alias Google keeps pointed at their current
    // recommended Flash model, so this stays working even as they retire
    // specific dated model names (which is what broke gemini-2.5-flash).
    model: 'gemini-flash-latest',
    tools,
    systemInstruction: `You are an operations assistant for a restaurant billing app. Today's date is ${today}. When the user asks to record an expense, a staff payment, or add a menu item, call the matching function. When they ask about sales, income, expenses, or balance for a time period, call get_summary with the correct date range computed from today's date (e.g. "this week" = the last 7 days including today, "this month" = the last 30 days, "today" = just today for both from and to). If the request is unclear or unrelated to restaurant operations, reply in plain text asking for clarification.`,
  });

  try {
    const result = await model.generateContent(message);
    const response = result.response;
    const call = response.functionCalls()?.[0];

    if (call) {
      return res.status(200).json({ type: 'function_call', name: call.name, args: call.args });
    }
    return res.status(200).json({ type: 'text', text: response.text() });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Assistant error' });
  }
}