import { describe, expect, it } from "vitest";
import { getModelContextWindow } from "./llm-config";

describe("getModelContextWindow", () => {
  it("returns the official context window for GLM-4.7", () => {
    expect(getModelContextWindow("glm-4.7")).toBe(200_000);
  });

  it("matches model ids case-insensitively", () => {
    expect(getModelContextWindow("GLM-4.7")).toBe(200_000);
  });

  it("does not guess the context window for unknown models", () => {
    expect(getModelContextWindow("custom-model")).toBeNull();
  });
});
