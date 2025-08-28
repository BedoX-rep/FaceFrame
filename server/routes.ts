import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analyzeFacialFeatures } from "./services/gemini";
import { frameSearchSchema } from "@shared/schema";
import { randomUUID } from "crypto";

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
  // Analyze face and get frame recommendations
  app.post("/api/analyze-face", upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No photo provided" });
      }

      const sessionId = req.body.sessionId || randomUUID();
      const imageBase64 = req.file.buffer.toString('base64');

      // Analyze facial features using Gemini
      const analysis = await analyzeFacialFeatures(imageBase64);

      // Save analysis to database
      const savedAnalysis = await storage.saveAnalysis({
        sessionId,
        faceShape: analysis.faceShape,
        recommendedSize: analysis.recommendedSize,
        recommendedColors: analysis.recommendedColors || [],
        recommendedStyles: analysis.recommendedStyles || [],
        confidence: analysis.confidence.toString(),
        analysisData: analysis,
      });

      // Search for matching frames
      const searchCriteria = {
        faceShape: analysis.faceShape,
        recommendedSize: analysis.recommendedSize,
        recommendedColors: analysis.recommendedColors,
        recommendedStyles: analysis.recommendedStyles,
      };

      const recommendedFrames = await storage.searchFrames(searchCriteria, 5);

      res.json({
        sessionId,
        analysis: savedAnalysis,
        recommendedFrames,
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
          imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=300&h=300&fit=crop',
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
          imageUrl: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=300&h=300&fit=crop',
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
          imageUrl: 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?w=300&h=300&fit=crop',
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
          imageUrl: 'https://images.unsplash.com/photo-1556306510-c0b89e82e72e?w=300&h=300&fit=crop',
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
          imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=300&h=300&fit=crop',
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

  const httpServer = createServer(app);
  return httpServer;
}
