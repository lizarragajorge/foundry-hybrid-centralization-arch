import { describe, it, expect, beforeEach } from "vitest";
import {
  addUsageRecord,
  getUsageRecords,
  clearUsageRecords,
  calcCost,
  aggregateByBU,
  aggregateByModel,
  aggregateBySource,
  MODEL_PRICING,
  type UsageRecord,
} from "@/lib/usage-tracker";

describe("usage-tracker", () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  describe("calcCost", () => {
    it("calculates GPT-4o cost correctly", () => {
      // 1000 prompt tokens + 1000 completion tokens
      const cost = calcCost("gpt-4o", 1000, 1000);
      const expected =
        (1000 / 1000) * MODEL_PRICING["gpt-4o"].prompt +
        (1000 / 1000) * MODEL_PRICING["gpt-4o"].completion;
      expect(cost).toBeCloseTo(expected);
    });

    it("calculates GPT-4o-mini cost correctly", () => {
      const cost = calcCost("gpt-4o-mini", 500, 200);
      const expected =
        (500 / 1000) * MODEL_PRICING["gpt-4o-mini"].prompt +
        (200 / 1000) * MODEL_PRICING["gpt-4o-mini"].completion;
      expect(cost).toBeCloseTo(expected);
    });

    it("returns 0 for embeddings completion cost", () => {
      const cost = calcCost("text-embedding-3-large", 1000, 0);
      expect(cost).toBeGreaterThan(0);
      // completion cost should be 0
      const completionOnlyCost = calcCost("text-embedding-3-large", 0, 1000);
      expect(completionOnlyCost).toBe(0);
    });

    it("returns 0 for unknown deployment", () => {
      expect(calcCost("unknown-model", 1000, 1000)).toBe(0);
    });
  });

  describe("record management", () => {
    const sampleRecord: Omit<UsageRecord, "id"> = {
      timestamp: new Date().toISOString(),
      bu: "Finance & Risk",
      model: "GPT-4o",
      deployment: "gpt-4o",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 500,
      success: true,
      source: "simulation",
    };

    it("adds and retrieves records", () => {
      addUsageRecord(sampleRecord);
      const records = getUsageRecords();
      expect(records).toHaveLength(1);
      expect(records[0].bu).toBe("Finance & Risk");
      expect(records[0].id).toBeDefined();
    });

    it("prepends new records (newest first)", () => {
      addUsageRecord({ ...sampleRecord, bu: "Finance & Risk" });
      addUsageRecord({ ...sampleRecord, bu: "Marketing & Sales" });
      const records = getUsageRecords();
      expect(records[0].bu).toBe("Marketing & Sales");
      expect(records[1].bu).toBe("Finance & Risk");
    });

    it("clears all records", () => {
      addUsageRecord(sampleRecord);
      addUsageRecord(sampleRecord);
      clearUsageRecords();
      expect(getUsageRecords()).toHaveLength(0);
    });
  });

  describe("aggregation", () => {
    beforeEach(() => {
      addUsageRecord({
        timestamp: new Date().toISOString(),
        bu: "Finance & Risk",
        model: "GPT-4o",
        deployment: "gpt-4o",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 500,
        success: true,
        source: "simulation",
      });
      addUsageRecord({
        timestamp: new Date().toISOString(),
        bu: "Finance & Risk",
        model: "GPT-4o-mini",
        deployment: "gpt-4o-mini",
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        latencyMs: 300,
        success: true,
        source: "arena",
      });
      addUsageRecord({
        timestamp: new Date().toISOString(),
        bu: "Marketing & Sales",
        model: "GPT-4o",
        deployment: "gpt-4o",
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225,
        latencyMs: 450,
        success: false,
        source: "loadtest",
      });
    });

    it("aggregates by BU", () => {
      const result = aggregateByBU(getUsageRecords());
      expect(result).toHaveLength(2);
      const finance = result.find((r) => r.bu === "Finance & Risk");
      expect(finance?.calls).toBe(2);
      expect(finance?.tokens).toBe(450);
      expect(finance?.successCalls).toBe(2);
      const marketing = result.find((r) => r.bu === "Marketing & Sales");
      expect(marketing?.calls).toBe(1);
      expect(marketing?.successCalls).toBe(0);
    });

    it("aggregates by model", () => {
      const result = aggregateByModel(getUsageRecords());
      expect(result).toHaveLength(2);
      const gpt4o = result.find((r) => r.model === "gpt-4o");
      expect(gpt4o?.calls).toBe(2);
      const mini = result.find((r) => r.model === "gpt-4o-mini");
      expect(mini?.calls).toBe(1);
    });

    it("aggregates by source", () => {
      const result = aggregateBySource(getUsageRecords());
      expect(result).toHaveLength(3);
      const sim = result.find((r) => r.source === "simulation");
      expect(sim?.calls).toBe(1);
    });

    it("normalizes short BU names via BU_META", () => {
      clearUsageRecords();
      addUsageRecord({
        timestamp: new Date().toISOString(),
        bu: "Finance",
        model: "GPT-4o",
        deployment: "gpt-4o",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 500,
        success: true,
        source: "loadtest",
      });
      const result = aggregateByBU(getUsageRecords());
      expect(result[0].bu).toBe("Finance & Risk");
    });
  });
});
