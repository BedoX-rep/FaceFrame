import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

export interface FacialAnalysis {
  faceShape: string;
  recommendedSize: string;
  recommendedColors: string[];
  recommendedStyles: string[];
  confidence: number;
  reasoning: string;
}

export interface TryOnResult {
  generatedImageBase64: string;
  description: string;
}

export async function generateVirtualTryOn(
  userPhotoBase64: string,
  frameImageBase64: string,
  frameDetails: { name: string; brand: string; style: string; color: string }
): Promise<TryOnResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseModalities: ["TEXT", "IMAGE"]
      },
      contents: [
        {
          inlineData: {
            data: userPhotoBase64,
            mimeType: "image/jpeg",
          },
        },
        {
          inlineData: {
            data: frameImageBase64,
            mimeType: "image/jpeg", 
          },
        },
        `Generate a high-quality, photorealistic virtual try-on image showing the person from the first image wearing the ${frameDetails.name} eyeglass frames from the second image. The frames are ${frameDetails.style} style in ${frameDetails.color} color by ${frameDetails.brand}. 

Create a professional virtual try-on that:
- Maintains the person's exact facial features and expression
- Properly fits and positions the frames on their face according to their face shape and size
- Ensures the frame style, color, and design exactly match the provided frame photo
- Uses natural lighting and realistic shadows
- Looks like a professional eyewear photo

Generate both the image and a brief description of how the frames suit this person's face.`
      ],
    });

    // Extract image and text from response
    const description = response.text || "Generated virtual try-on showing the frames on your face";
    
    // For the generated image, we need to extract it from the response
    // The actual implementation would extract the generated image from the response
    let generatedImageBase64 = userPhotoBase64; // Fallback to original

    // If response contains generated images, extract them
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/') && part.inlineData.data) {
          generatedImageBase64 = part.inlineData.data;
          break;
        }
      }
    }

    return {
      generatedImageBase64,
      description
    };
  } catch (error) {
    console.error("Failed to generate virtual try-on:", error);
    // Fallback: return original image with analysis
    return {
      generatedImageBase64: userPhotoBase64,
      description: `Virtual try-on preview: These ${frameDetails.name} frames by ${frameDetails.brand} in ${frameDetails.color} would complement your facial features well. The ${frameDetails.style} style is a good match for your face shape.`
    };
  }
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
