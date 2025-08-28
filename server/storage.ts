import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { type User, type InsertUser, type Frame, type InsertFrame, type AnalysisResult, type InsertAnalysis, type FrameSearchCriteria } from "@shared/schema";
import { users, frames, analysisResults } from "@shared/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = neon(connectionString);
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
    // Build dynamic query based on criteria
    const conditions = [
      eq(frames.isActive, true)
    ];

    // Add face shape matching if available
    if (criteria.faceShape) {
      conditions.push(
        sql`${frames.suitableFaceShapes} @> ${[criteria.faceShape]}`
      );
    }

    // Add size matching
    if (criteria.recommendedSize) {
      conditions.push(eq(frames.size, criteria.recommendedSize));
    }

    // Add color matching if colors are specified
    if (criteria.recommendedColors && criteria.recommendedColors.length > 0) {
      conditions.push(
        inArray(frames.color, criteria.recommendedColors)
      );
    }

    // Add style matching if styles are specified
    if (criteria.recommendedStyles && criteria.recommendedStyles.length > 0) {
      conditions.push(
        inArray(frames.style, criteria.recommendedStyles)
      );
    }

    const result = await db
      .select()
      .from(frames)
      .where(and(...conditions))
      .orderBy(desc(frames.stockCount)) // Prioritize in-stock items
      .limit(limit);

    return result;
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
