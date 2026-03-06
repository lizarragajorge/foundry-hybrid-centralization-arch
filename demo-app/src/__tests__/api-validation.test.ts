import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-declare the schemas here to test them in isolation
// (mirrors the schemas in the API route files)

const FoundryRequestSchema = z.object({
  deployment: z.string().min(1, "deployment is required"),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).optional(),
  input: z.union([z.string(), z.array(z.string())]).optional(),
  maxTokens: z.number().int().min(1).max(4096).default(200),
}).refine(
  (data) => data.messages || data.input,
  { message: "Either messages (for chat) or input (for embeddings) is required" }
);

const GuardrailsRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).min(1, "At least one message is required"),
  deployment: z.string().min(1).default("gpt-4o-mini"),
  maxTokens: z.number().int().min(1).max(4096).default(100),
});

describe("API request validation schemas", () => {
  describe("FoundryRequestSchema", () => {
    it("accepts valid chat request", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid embedding request", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "text-embedding-3-large",
        input: "Some text to embed",
      });
      expect(result.success).toBe(true);
    });

    it("accepts array input for embeddings", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "text-embedding-3-large",
        input: ["text 1", "text 2"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing deployment", () => {
      const result = FoundryRequestSchema.safeParse({
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty deployment", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "",
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects request with neither messages nor input", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "gpt-4o",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid role", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "gpt-4o",
        messages: [{ role: "admin", content: "Hello" }],
      });
      expect(result.success).toBe(false);
    });

    it("applies default maxTokens", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTokens).toBe(200);
      }
    });

    it("rejects maxTokens over 4096", () => {
      const result = FoundryRequestSchema.safeParse({
        deployment: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 10000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GuardrailsRequestSchema", () => {
    it("accepts valid request", () => {
      const result = GuardrailsRequestSchema.safeParse({
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.success).toBe(true);
    });

    it("applies default deployment", () => {
      const result = GuardrailsRequestSchema.safeParse({
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deployment).toBe("gpt-4o-mini");
      }
    });

    it("rejects empty messages array", () => {
      const result = GuardrailsRequestSchema.safeParse({
        messages: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing messages", () => {
      const result = GuardrailsRequestSchema.safeParse({
        deployment: "gpt-4o",
      });
      expect(result.success).toBe(false);
    });
  });
});
