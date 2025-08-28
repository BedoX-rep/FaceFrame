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
        recommendedColors: analysis.recommendedColors,
        recommendedStyles: analysis.recommendedStyles,
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

  const httpServer = createServer(app);
  return httpServer;
}
