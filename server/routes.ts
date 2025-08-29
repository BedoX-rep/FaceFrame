import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analyzeFacialFeatures, generateVirtualTryOn } from "./services/gemini";
import { frameSearchSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { storageService } from "./services/supabase-storage";
import { join } from "path";

// Configure multer for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Analyze face and get frame recommendations with virtual try-on
  app.post("/api/analyze-face", upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No photo provided" });
      }

      const sessionId = req.body.sessionId || randomUUID();
      const imageBase64 = req.file.buffer.toString('base64');

      // Step 1: Analyze facial features using Gemini
      console.log("Step 1: Analyzing facial features...");
      const analysis = await analyzeFacialFeatures(imageBase64);

      // Step 2: Save analysis to database
      console.log("Step 2: Saving analysis to database...");
      const savedAnalysis = await storage.saveAnalysis({
        sessionId,
        faceShape: analysis.faceShape,
        recommendedSizes: analysis.recommendedSizes,
        recommendedColors: analysis.recommendedColors || [],
        recommendedStyles: analysis.recommendedStyles || [],
        confidence: analysis.confidence?.toString() || "0.80",
        analysisData: analysis,
      });

      // Step 3: Search for matching frames
      console.log("Step 3: Searching for matching frames...");
      const searchCriteria = {
        faceShape: analysis.faceShape,
        recommendedSizes: analysis.recommendedSizes,
        recommendedColors: analysis.recommendedColors,
        recommendedStyles: analysis.recommendedStyles,
      };

      const recommendedFrames = await storage.searchFrames(searchCriteria, 5);

      // Step 4: Generate virtual try-on images for each recommended frame
      console.log("Step 4: Generating virtual try-on images...");
      const framesWithTryOn: Array<{
        frameId: string;
        virtualTryOnImage: string | null;
        description: string;
      }> = [];

      for (const frame of recommendedFrames) {
        try {
          // For this demo, we'll use a placeholder frame image
          // In a real implementation, you'd fetch the actual frame image from frame.imageUrl
          let frameImageBase64 = imageBase64; // Placeholder - would be the actual frame photo
          
          // If frame has an imageUrl, you could fetch it and convert to base64
          if (frame.imageUrl && frame.imageUrl.startsWith('data:image/')) {
            frameImageBase64 = frame.imageUrl.split(',')[1];
          }

          const virtualTryOn = await generateVirtualTryOn(
            imageBase64,
            {
              name: frame.name,
              brand: frame.brand,
              style: frame.style,
              color: frame.color,
            }
          );

          framesWithTryOn.push({
            frameId: frame.id,
            virtualTryOnImage: virtualTryOn.generatedImageBase64,
            description: virtualTryOn.description,
          });
        } catch (tryOnError) {
          console.error(`Failed to generate try-on for frame ${frame.id}:`, tryOnError);
          
          // Still include the frame but without virtual try-on
          framesWithTryOn.push({
            frameId: frame.id,
            virtualTryOnImage: null,
            description: "Virtual try-on temporarily unavailable due to API limits"
          });
        }
      }

      console.log("Step 5: Completed! Sending results to client...");
      
      // Map frames with try-on data to the expected format
      const framesWithVirtualTryOn = recommendedFrames.map((frame, index) => {
        const tryOnData = framesWithTryOn.find(tryOn => tryOn.frameId === frame.id);
        return {
          ...frame,
          virtualTryOn: tryOnData ? {
            imageBase64: tryOnData.virtualTryOnImage,
            description: tryOnData.description
          } : null
        };
      });

      res.json({
        sessionId,
        analysis: {
          faceShape: analysis.faceShape,
          recommendedSizes: analysis.recommendedSizes,
          recommendedColors: analysis.recommendedColors,
          recommendedStyles: analysis.recommendedStyles,
          confidence: analysis.confidence
        },
        recommendedFrames: framesWithVirtualTryOn,
        message: `Generated ${framesWithTryOn.length} virtual try-on images`,
      });
    } catch (error) {
      console.error("Face analysis error:", error);
      res.status(500).json({ 
        message: "Failed to analyze face. Please ensure you have a clear photo and try again." 
      });
    }
  });

  // Get frame recommendations based on search criteria
  app.post("/api/search-frames", async (req, res) => {
    try {
      const searchCriteria = frameSearchSchema.parse(req.body);
      const limit = parseInt(req.query.limit as string) || 5;
      
      const frames = await storage.searchFrames(searchCriteria, limit);
      
      res.json({ frames });
    } catch (error) {
      console.error("Frame search error:", error);
      res.status(500).json({ 
        message: "Failed to search frames. Please try again." 
      });
    }
  });

  // Get all frames
  app.get("/api/frames", async (req, res) => {
    try {
      const frames = await storage.getAllFrames();
      res.json({ frames });
    } catch (error) {
      console.error("Get frames error:", error);
      res.status(500).json({ 
        message: "Failed to retrieve frames." 
      });
    }
  });

  // Get specific frame by ID
  app.get("/api/frames/:id", async (req, res) => {
    try {
      const frameId = req.params.id;
      const frame = await storage.getFrame(frameId);
      
      if (!frame) {
        return res.status(404).json({ message: "Frame not found" });
      }
      
      res.json({ frame });
    } catch (error) {
      console.error("Get frame error:", error);
      res.status(500).json({ 
        message: "Failed to retrieve frame." 
      });
    }
  });

  // Get analysis results by session ID
  app.get("/api/analysis/:sessionId", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const analysis = await storage.getAnalysisBySession(sessionId);
      
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      
      res.json({ analysis });
    } catch (error) {
      console.error("Get analysis error:", error);
      res.status(500).json({ 
        message: "Failed to retrieve analysis." 
      });
    }
  });

  // Development endpoint to seed test frame data
  app.post("/api/seed-frames", async (req, res) => {
    try {
      const testFrames = [
        {
          name: 'Classic Aviator',
          brand: 'Ray-Ban',
          style: 'Aviator',
          color: 'Gold',
          size: 'Medium',
          price: '189.99',
          stockStatus: 'in_stock',
          stockCount: 25,
          imageUrl: '/attached_assets/generated_images/Gold_aviator_eyeglasses_9ca53d83.png',
          description: 'Timeless aviator design with gold frame and green lenses',
          features: { material: 'metal', lens_type: 'polarized', weight: 'lightweight' },
          suitableFaceShapes: ['oval', 'square', 'heart']
        },
        {
          name: 'Wayfarer Black',
          brand: 'Ray-Ban', 
          style: 'Rectangle',
          color: 'Black',
          size: 'Large',
          price: '159.99',
          stockStatus: 'in_stock',
          stockCount: 18,
          imageUrl: '/attached_assets/generated_images/Black_wayfarer_eyeglasses_b2d959c7.png',
          description: 'Classic black wayfarer style perfect for any occasion',
          features: { material: 'acetate', lens_type: 'standard', weight: 'medium' },
          suitableFaceShapes: ['round', 'oval', 'diamond']
        },
        {
          name: 'Round Vintage',
          brand: 'Oliver Peoples',
          style: 'Round',
          color: 'Tortoise', 
          size: 'Small',
          price: '299.99',
          stockStatus: 'in_stock',
          stockCount: 12,
          imageUrl: '/attached_assets/generated_images/Tortoise_round_vintage_eyeglasses_921ed3aa.png',
          description: 'Vintage-inspired round frames in classic tortoise pattern',
          features: { material: 'acetate', lens_type: 'anti_glare', weight: 'lightweight' },
          suitableFaceShapes: ['square', 'heart', 'oblong']
        },
        {
          name: 'Modern Square',
          brand: 'Warby Parker',
          style: 'Square',
          color: 'Blue',
          size: 'Medium',
          price: '95.99',
          stockStatus: 'low_stock',
          stockCount: 3,
          imageUrl: '/attached_assets/generated_images/Blue_modern_square_eyeglasses_178251b7.png',
          description: 'Contemporary square frames in stylish blue',
          features: { material: 'acetate', lens_type: 'blue_light', weight: 'lightweight' },
          suitableFaceShapes: ['round', 'oval']
        },
        {
          name: 'Cat-Eye Classic',
          brand: 'Tom Ford',
          style: 'Cat-eye',
          color: 'Black',
          size: 'Small', 
          price: '450.00',
          stockStatus: 'in_stock',
          stockCount: 8,
          imageUrl: '/attached_assets/generated_images/Black_cat-eye_elegant_eyeglasses_7ff7e41a.png',
          description: 'Elegant cat-eye frames for a sophisticated look',
          features: { material: 'acetate', lens_type: 'standard', weight: 'medium' },
          suitableFaceShapes: ['heart', 'diamond', 'oval']
        }
      ];

      const savedFrames = [];
      for (const frame of testFrames) {
        const savedFrame = await storage.createFrame(frame);
        savedFrames.push(savedFrame);
      }

      res.json({ 
        message: `Successfully added ${savedFrames.length} test frames`,
        frames: savedFrames 
      });
    } catch (error) {
      console.error("Seed frames error:", error);
      res.status(500).json({ 
        message: "Failed to seed test frames." 
      });
    }
  });

  // Upload generated images to Supabase storage and update frame URLs
  app.post("/api/upload-frame-images", async (req, res) => {
    try {
      const frameImageMappings = [
        {
          localPath: join(process.cwd(), "attached_assets/generated_images/Gold_aviator_eyeglasses_9ca53d83.png"),
          fileName: "aviator-gold.png",
          frameName: "Classic Aviator"
        },
        {
          localPath: join(process.cwd(), "attached_assets/generated_images/Black_wayfarer_eyeglasses_b2d959c7.png"),
          fileName: "wayfarer-black.png",
          frameName: "Wayfarer Black"
        },
        {
          localPath: join(process.cwd(), "attached_assets/generated_images/Tortoise_round_vintage_eyeglasses_921ed3aa.png"),
          fileName: "round-tortoise.png",
          frameName: "Round Vintage"
        },
        {
          localPath: join(process.cwd(), "attached_assets/generated_images/Blue_modern_square_eyeglasses_178251b7.png"),
          fileName: "square-blue.png",
          frameName: "Modern Square"
        },
        {
          localPath: join(process.cwd(), "attached_assets/generated_images/Black_cat-eye_elegant_eyeglasses_7ff7e41a.png"),
          fileName: "cat-eye-black.png",
          frameName: "Cat-Eye Classic"
        }
      ];

      const uploadResults = [];
      
      for (const mapping of frameImageMappings) {
        try {
          // Upload image to Supabase storage
          const uploadResult = await storageService.uploadImage(mapping.localPath, mapping.fileName);
          
          // Update frame in database with new URL
          const frames = await storage.getAllFrames();
          const frame = frames.find(f => f.name === mapping.frameName);
          
          if (frame) {
            // Update the frame's imageUrl in the database
            await storage.updateFrameImageUrl(frame.id, uploadResult.publicUrl);
            uploadResults.push({
              frameName: mapping.frameName,
              fileName: mapping.fileName,
              publicUrl: uploadResult.publicUrl,
              updated: true
            });
          } else {
            uploadResults.push({
              frameName: mapping.frameName,
              fileName: mapping.fileName,
              publicUrl: uploadResult.publicUrl,
              updated: false,
              error: "Frame not found in database"
            });
          }
        } catch (uploadError) {
          console.error(`Failed to upload ${mapping.fileName}:`, uploadError);
          uploadResults.push({
            frameName: mapping.frameName,
            fileName: mapping.fileName,
            error: uploadError instanceof Error ? uploadError.message : 'Unknown error',
            updated: false
          });
        }
      }

      res.json({
        message: `Processed ${uploadResults.length} frame images`,
        results: uploadResults
      });
    } catch (error) {
      console.error("Upload frame images error:", error);
      res.status(500).json({
        message: "Failed to upload frame images to storage."
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
