import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const frames = pgTable("frames", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  style: text("style").notNull(), // Rectangle, Round, Aviator, Square, etc.
  color: text("color").notNull(),
  size: text("size").notNull(), // Small, Medium, Large
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stockStatus: text("stock_status").notNull().default("in_stock"), // in_stock, low_stock, out_of_stock, order_only
  stockCount: integer("stock_count").default(0),
  imageUrl: text("image_url").notNull(),
  description: text("description"),
  features: jsonb("features"), // Additional features like material, weight, etc.
  suitableFaceShapes: text("suitable_face_shapes").array(), // oval, round, square, heart, diamond
  isActive: boolean("is_active").default(true),
});

export const analysisResults = pgTable("analysis_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  faceShape: text("face_shape").notNull(),
  recommendedSizes: text("recommended_sizes").array().notNull(),
  recommendedColors: text("recommended_colors").array(),
  recommendedStyles: text("recommended_styles").array(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  analysisData: jsonb("analysis_data"), // Full AI response
  createdAt: text("created_at").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFrameSchema = createInsertSchema(frames).omit({
  id: true,
});

export const insertAnalysisSchema = createInsertSchema(analysisResults).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Frame = typeof frames.$inferSelect;
export type InsertFrame = z.infer<typeof insertFrameSchema>;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;

// Frame search criteria schema
export const frameSearchSchema = z.object({
  faceShape: z.string(),
  recommendedSizes: z.array(z.string()),
  recommendedColors: z.array(z.string()),
  recommendedStyles: z.array(z.string()),
});

export type FrameSearchCriteria = z.infer<typeof frameSearchSchema>;
