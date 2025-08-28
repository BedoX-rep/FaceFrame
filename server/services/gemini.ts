import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface FacialAnalysis {
  faceShape: string;
  recommendedSize: string;
  recommendedColors: string[];
  recommendedStyles: string[];
  confidence: number;
  reasoning: string;
}

export async function analyzeFacialFeatures(imageBase64: string): Promise<FacialAnalysis> {
  try {
    const systemPrompt = `You are an expert optical stylist and facial feature analyst. 
Analyze the person's face in the image and provide frame recommendations.

Your task is to:
1. Determine the face shape (oval, round, square, heart, diamond, oblong)
2. Recommend frame size (Small, Medium, Large) based on facial proportions
3. Suggest frame colors that complement skin tone and features
4. Recommend frame styles that enhance facial features

Consider factors like:
- Face width vs length ratio
- Jawline shape and prominence
- Cheekbone width and height
- Forehead width
- Skin tone and undertones
- Eye spacing and size

Respond with JSON in the exact format specified in the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            faceShape: { 
              type: "string", 
              enum: ["oval", "round", "square", "heart", "diamond", "oblong"]
            },
            recommendedSize: { 
              type: "string", 
              enum: ["Small", "Medium", "Large"] 
            },
            recommendedColors: { 
              type: "array", 
              items: { type: "string" },
              description: "Colors like Black, Brown, Tortoise, Silver, Gold, Blue, etc."
            },
            recommendedStyles: { 
              type: "array", 
              items: { type: "string" },
              description: "Styles like Rectangle, Round, Aviator, Square, Cat-eye, etc."
            },
            confidence: { 
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence score between 0 and 1"
            },
            reasoning: { 
              type: "string",
              description: "Brief explanation of the recommendations"
            }
          },
          required: ["faceShape", "recommendedSize", "recommendedColors", "recommendedStyles", "confidence", "reasoning"]
        },
      },
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
          },
        },
        "Analyze this person's facial features and provide detailed eyeglass frame recommendations based on their face shape, size, and features."
      ],
    });

    const rawJson = response.text;

    if (!rawJson) {
      throw new Error("Empty response from Gemini model");
    }

    const data: FacialAnalysis = JSON.parse(rawJson);
    
    // Validate the response
    if (!data.faceShape || !data.recommendedSize || !data.recommendedColors || !data.recommendedStyles) {
      throw new Error("Invalid response format from Gemini model");
    }

    return data;
  } catch (error) {
    console.error("Failed to analyze facial features:", error);
    throw new Error(`Failed to analyze facial features: ${error}`);
  }
}
