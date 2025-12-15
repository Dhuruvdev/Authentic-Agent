import { z } from "zod";

// Input Types
export type InputType = "email" | "username" | "image_url" | "unknown";

// NH-Signal: Input classification result
export const inputClassificationSchema = z.object({
  type: z.enum(["email", "username", "image_url", "unknown"]),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  isValid: z.boolean(),
  validationMessage: z.string().optional(),
});
export type InputClassification = z.infer<typeof inputClassificationSchema>;

// Chain Event for SSE streaming
export type ChainEventStatus = "pending" | "processing" | "complete" | "error" | "skipped";

export const chainEventSchema = z.object({
  id: z.string(),
  module: z.string(),
  message: z.string(),
  status: z.enum(["pending", "processing", "complete", "error", "skipped"]),
  timestamp: z.string(),
  details: z.any().optional(),
});
export type ChainEvent = z.infer<typeof chainEventSchema>;

// NH-Breach: Breach intelligence result
export type BreachSeverity = "low" | "medium" | "high" | "critical";

export const breachResultSchema = z.object({
  found: z.boolean(),
  breachCount: z.number(),
  sources: z.array(z.object({
    name: z.string(),
    domain: z.string().optional(),
    breachDate: z.string().optional(),
    dataClasses: z.array(z.string()).optional(),
    pwnCount: z.number().optional(),
  })),
  severity: z.enum(["low", "medium", "high", "critical"]),
  apiAvailable: z.boolean(),
  limitationNote: z.string().optional(),
});
export type BreachResult = z.infer<typeof breachResultSchema>;

// NH-Correlate: Username correlation result
export type CorrelationRisk = "low" | "medium" | "high";

export const correlationResultSchema = z.object({
  matches: z.array(z.object({
    platform: z.string(),
    url: z.string().optional(),
    available: z.boolean(),
    confidence: z.number(),
  })),
  risk: z.enum(["low", "medium", "high"]),
  checkedPlatforms: z.array(z.string()),
  limitationNote: z.string().optional(),
});
export type CorrelationResult = z.infer<typeof correlationResultSchema>;

// NH-FaceRisk: Image exposure result
export const imageRiskResultSchema = z.object({
  analyzed: z.boolean(),
  perceptualHash: z.string().optional(),
  exposureIndicators: z.array(z.object({
    source: z.string(),
    matchConfidence: z.number(),
    url: z.string().optional(),
  })),
  riskLevel: z.enum(["low", "medium", "high"]),
  disclaimer: z.string(),
  limitationNote: z.string().optional(),
});
export type ImageRiskResult = z.infer<typeof imageRiskResultSchema>;

// NH-Verdict: Aggregated verdict
export type RiskLevel = "low" | "medium" | "high";

export const verdictSchema = z.object({
  exposureScore: z.number().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  factors: z.array(z.object({
    factor: z.string(),
    impact: z.enum(["positive", "negative", "neutral"]),
    weight: z.number(),
  })),
});
export type Verdict = z.infer<typeof verdictSchema>;

// NH-Response: Actionable guidance
export const guidanceSchema = z.object({
  recommendations: z.array(z.object({
    priority: z.number(),
    category: z.enum(["account_security", "privacy", "platform_action", "monitoring"]),
    title: z.string(),
    description: z.string(),
    urgency: z.enum(["immediate", "soon", "when_possible"]),
  })),
});
export type Guidance = z.infer<typeof guidanceSchema>;

// NH-Explain: Transparency data
export const transparencySchema = z.object({
  whatWasChecked: z.array(z.string()),
  whatWasNotChecked: z.array(z.string()),
  dataSources: z.array(z.object({
    name: z.string(),
    type: z.enum(["api", "public_check", "heuristic"]),
    description: z.string(),
  })),
  legalScope: z.string(),
  timestamp: z.string(),
});
export type Transparency = z.infer<typeof transparencySchema>;

// Complete scan result
export const scanResultSchema = z.object({
  id: z.string(),
  input: inputClassificationSchema,
  breach: breachResultSchema.optional(),
  correlation: correlationResultSchema.optional(),
  imageRisk: imageRiskResultSchema.optional(),
  verdict: verdictSchema,
  guidance: guidanceSchema,
  transparency: transparencySchema,
  completedAt: z.string(),
});
export type ScanResult = z.infer<typeof scanResultSchema>;

// API Request schemas
export const scanRequestSchema = z.object({
  input: z.string().min(1, "Input is required"),
});
export type ScanRequest = z.infer<typeof scanRequestSchema>;

// Keep existing user schema for potential future use
import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
