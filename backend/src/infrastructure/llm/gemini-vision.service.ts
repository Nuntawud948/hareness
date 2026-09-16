import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedReceiptData {
  merchantName: string;
  totalAmount: number;
  currency: string;
  billDate: string; // ISO date or best guess
  category: string;
  summaryText: string;
  items: Array<{
    name: string;
    quantity?: number;
    price?: number;
  }>;
}

export class GeminiVisionReceiptScanner {
  async scanReceipt(
    apiKey: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<ParsedReceiptData> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const base64Image = imageBuffer.toString('base64');

    const prompt = `You are an expert AI Secretary and Accountant. Analyze this receipt or bill image accurately.
Extract the information and respond ONLY with a raw JSON object (without markdown fences, backticks, or other text).
JSON format:
{
  "merchantName": "Store/Company Name in Thai or English",
  "totalAmount": 0.00,
  "currency": "THB",
  "billDate": "YYYY-MM-DD or empty string",
  "category": "Food | Fuel | Office | Utilities | Transportation | Entertainment | Other",
  "summaryText": "Brief friendly summary in Thai describing this expense",
  "items": [
    { "name": "Item name", "quantity": 1, "price": 0.00 }
  ]
}
If any field is unclear, make your best intelligent estimate. totalAmount must be a numeric float number.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
    ]);

    const text = result.response.text().trim();
    // Clean potential markdown blocks
    const cleanedJson = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    try {
      const parsed = JSON.parse(cleanedJson);
      return {
        merchantName: parsed.merchantName || 'ร้านค้าทั่วไป',
        totalAmount: typeof parsed.totalAmount === 'number' ? parsed.totalAmount : parseFloat(parsed.totalAmount || '0') || 0,
        currency: parsed.currency || 'THB',
        billDate: parsed.billDate || new Date().toISOString().split('T')[0],
        category: parsed.category || 'Other',
        summaryText: parsed.summaryText || `บิลค่าใช้จ่าย ${parsed.merchantName || ''}`,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch (e) {
      console.error('Failed to parse Gemini Vision JSON:', text);
      return {
        merchantName: 'บิลค่าใช้จ่าย',
        totalAmount: 0,
        currency: 'THB',
        billDate: new Date().toISOString().split('T')[0],
        category: 'Other',
        summaryText: text.substring(0, 200),
        items: [],
      };
    }
  }
}
