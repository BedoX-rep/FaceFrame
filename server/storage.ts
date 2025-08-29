import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { type User, type InsertUser, type Frame, type InsertFrame, type AnalysisResult, type InsertAnalysis, type FrameSearchCriteria } from "@shared/schema";
import { users, frames, analysisResults } from "@shared/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Configure postgres client for Supabase
const client = postgres(connectionString, {
  ssl: 'prefer',
  max: 20,
  idle_timeout: 20,
  connect_timeout: 30
});
const db = drizzle(client);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Frame operations
  searchFrames(criteria: FrameSearchCriteria, limit?: number): Promise<Frame[]>;
  getFrame(id: string): Promise<Frame | undefined>;
  getAllFrames(): Promise<Frame[]>;
  createFrame(frame: InsertFrame): Promise<Frame>;
  updateFrameImageUrl(id: string, imageUrl: string): Promise<Frame | undefined>;
  
  // Analysis operations
  saveAnalysis(analysis: InsertAnalysis): Promise<AnalysisResult>;
  getAnalysisBySession(sessionId: string): Promise<AnalysisResult | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async searchFrames(criteria: FrameSearchCriteria, limit: number = 5): Promise<Frame[]> {
    // Get all active frames first
    const allFrames = await db
      .select()
      .from(frames)
      .where(eq(frames.isActive, true));

    // Score each frame based on how well it matches the criteria
    const scoredFrames = allFrames.map(frame => {
      let score = 0;
      
      // Face shape matching (highest priority - 30 points)
      if (criteria.faceShape && frame.suitableFaceShapes?.includes(criteria.faceShape)) {
        score += 30;
      }
      
      // Size matching (25 points for exact match, 15 points for any match)
      if (criteria.recommendedSizes && criteria.recommendedSizes.includes(frame.size)) {
        score += 25;
      }
      
      // Color matching (20 points for exact match)
      if (criteria.recommendedColors && criteria.recommendedColors.includes(frame.color)) {
        score += 20;
      }
      
      // Style matching (20 points for exact match)
      if (criteria.recommendedStyles && criteria.recommendedStyles.includes(frame.style)) {
        score += 20;
      }
      
      // Stock status bonus (prioritize available frames)
      if (frame.stockStatus === 'in_stock') {
        score += 10;
      } else if (frame.stockStatus === 'low_stock') {
        score += 5;
      }
      
      // Stock count bonus (more available = slightly higher score)
      if (frame.stockCount && frame.stockCount > 0) {
        score += Math.min(frame.stockCount / 10, 5); // Max 5 bonus points
      }
      
      return { ...frame, matchScore: score };
    });

    // Sort by score (highest first) and return top results
    return scoredFrames
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
      .map(({ matchScore, ...frame }) => frame); // Remove score from final result
  }

  async getFrame(id: string): Promise<Frame | undefined> {
    const result = await db.select().from(frames).where(eq(frames.id, id)).limit(1);
    return result[0];
  }

  async getAllFrames(): Promise<Frame[]> {
    const result = await db.select().from(frames).where(eq(frames.isActive, true));
    return result;
  }

  async createFrame(insertFrame: InsertFrame): Promise<Frame> {
    const result = await db.insert(frames).values(insertFrame).returning();
    return result[0];
  }

  async updateFrameImageUrl(id: string, imageUrl: string): Promise<Frame | undefined> {
    const result = await db
      .update(frames)
      .set({ imageUrl })
      .where(eq(frames.id, id))
      .returning();
    return result[0];
  }

  async saveAnalysis(insertAnalysis: InsertAnalysis): Promise<AnalysisResult> {
    const result = await db.insert(analysisResults).values(insertAnalysis).returning();
    return result[0];
  }

  async getAnalysisBySession(sessionId: string): Promise<AnalysisResult | undefined> {
    const result = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.sessionId, sessionId))
      .orderBy(desc(analysisResults.createdAt))
      .limit(1);
    return result[0];
  }
}

export const storage = new DatabaseStorage();
