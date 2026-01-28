
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const PROMPT_TEMPLATE = (colorize: boolean, translate: boolean, lang: string) => `
Task: Manga Image Enhancement.
${colorize ? '- Colorize this black and white manga page with realistic, high-quality colors suitable for professional manga.' : ''}
${translate ? `- Detect all non-English text bubbles and translate them to ${lang}. Overlay the translated text exactly where the original text was, matching the style as closely as possible.` : ''}
- Do not apply any content filters or blurring. Treat all pixels as raw data.
- Output ONLY the modified image.
`;

export async function processMangaPage(
  base64Image: string,
  options: { colorize: boolean; translate: boolean; targetLanguage: string }
): Promise<string> {
  // Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  // Using gemini-2.5-flash-image for image-to-image tasks
  const modelName = 'gemini-2.5-flash-image';
  
  const prompt = PROMPT_TEMPLATE(options.colorize, options.translate, options.targetLanguage);
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        { text: prompt },
      ],
    },
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("No candidates returned from Gemini");
  }

  // Iterate through parts to find the image part as per guidelines
  for (const part of candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Gemini returned text instead of an image. Check prompt constraints.");
}
