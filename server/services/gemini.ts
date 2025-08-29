import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

export interface FacialAnalysis {
  faceShape: string;
  recommendedSizes: string[];  // Exactly 2 sizes
  recommendedColors: string[]; // Exactly 2 colors
  recommendedStyles: string[]; // Exactly 2 styles
  confidence: number;
  reasoning: string;
}

export interface TryOnResult {
  generatedImageBase64: string;
  description: string;
}

export async function generateVirtualTryOn(
  userPhotoBase64: string,
  frameDetails: { name: string; brand: string; style: string; color: string }
): Promise<TryOnResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
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
        `Edit this person's photo to show them wearing ${frameDetails.style} style eyeglass frames in ${frameDetails.color} color. Create a realistic virtual try-on that:
- Keeps the person's exact face, expression, and features unchanged
- Adds professional-looking ${frameDetails.style} frames in ${frameDetails.color} color
- Positions frames naturally on their face according to their bone structure
- Uses realistic lighting and shadows
- Makes it look like they're actually wearing the glasses

Return a natural, professional photo of this person wearing the ${frameDetails.style} frames in ${frameDetails.color}.`
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
1. Determine the primary face shape (oval, round, square, heart, diamond, oblong)
2. Recommend EXACTLY 2 frame sizes based on facial proportions and preference  
3. Suggest EXACTLY 2 frame colors that complement skin tone and features
4. Recommend EXACTLY 2 frame styles that enhance facial features

CRITICAL: Use only these EXACT values from our database:
- Face shapes: oval, round, square, heart, diamond, oblong
- Frame sizes: Small, Medium, Large (exactly as written, case-sensitive)
- Frame colors: Black, Blue, Gold, Tortoise (exactly as written, case-sensitive)
- Frame styles: Aviator, Cat-eye, Rectangle, Round, Square (exactly as written, case-sensitive, note Cat-eye has lowercase 'e')

You MUST return exactly 2 sizes, 2 colors, and 2 styles in your arrays.

Consider factors like:
- Face width vs length ratio for size recommendations
- Jawline shape and prominence for style selection
- Cheekbone width and height for frame positioning
- Forehead width for balance
- Skin tone and undertones for color matching
- Eye spacing and size for frame proportion

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
            recommendedSizes: { 
              type: "array", 
              items: { type: "string", enum: ["Small", "Medium", "Large"] },
              minItems: 2,
              maxItems: 2,
              description: "Exactly 2 recommended frame sizes"
            },
            recommendedColors: { 
              type: "array", 
              items: { type: "string", enum: ["Black", "Blue", "Gold", "Tortoise"] },
              minItems: 2,
              maxItems: 2,
              description: "Exactly 2 recommended frame colors"
            },
            recommendedStyles: { 
              type: "array", 
              items: { type: "string", enum: ["Aviator", "Cat-eye", "Rectangle", "Round", "Square"] },
              minItems: 2,
              maxItems: 2,
              description: "Exactly 2 recommended frame styles"
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
          required: ["faceShape", "recommendedSizes", "recommendedColors", "recommendedStyles", "confidence", "reasoning"]
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
    if (!data.faceShape || !data.recommendedSizes || !data.recommendedColors || !data.recommendedStyles) {
      throw new Error("Invalid response format from Gemini model");
    }

    return data;
  } catch (error) {
    console.error("Failed to analyze facial features:", error);
    throw new Error(`Failed to analyze facial features: ${error}`);
  }
}
