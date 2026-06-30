import { describe, it, expect } from "vitest";
import { LoopDetector } from "./loop-detector";

describe("LoopDetector", () => {
  it("无重复 → 无检测", () => {
    const d = new LoopDetector();
    expect(d.check({ toolName: "retrieve-context", args: { query: "a" } })).toBeNull();
    expect(d.check({ toolName: "retrieve-context", args: { query: "b" } })).toBeNull();
  });

  it("相同指纹连续 ≥2 → hash-loop", () => {
    const d = new LoopDetector();
    d.check({ toolName: "renderUI", args: { x: 1 } });
    const r = d.check({ toolName: "renderUI", args: { x: 1 } });
    expect(r?.type).toBe("hash-loop");
    expect(r?.toolName).toBe("renderUI");
  });

  it("A→B→A→B → ping-pong", () => {
    const d = new LoopDetector();
    d.check({ toolName: "a", args: {} });
    d.check({ toolName: "b", args: {} });
    d.check({ toolName: "a", args: {} });
    const r = d.check({ toolName: "b", args: {} });
    expect(r?.type).toBe("ping-pong");
  });

  it("retrieve-context 白名单放宽：连续 2 次相同不报 hash-loop", () => {
    const d = new LoopDetector();
    d.check({ toolName: "retrieve-context", args: { query: "a" } });
    const r = d.check({ toolName: "retrieve-context", args: { query: "a" } });
    expect(r).toBeNull();
  });

  it("retrieve-context 连续 5 次相同 → 仍熔断", () => {
    const d = new LoopDetector();
    for (let i = 0; i < 4; i++) d.check({ toolName: "retrieve-context", args: { query: "a" } });
    const r = d.check({ toolName: "retrieve-context", args: { query: "a" } });
    expect(r?.type).toBe("hash-loop");
  });

  it("纠正次数累计 ≥3 → circuit-break", () => {
    const d = new LoopDetector();
    for (let cycle = 0; cycle < 3; cycle++) {
      d.check({ toolName: "renderUI", args: { x: cycle } });
      const r = d.check({ toolName: "renderUI", args: { x: cycle } });
      d.recordCorrection();
      if (cycle < 2) expect(r?.type).toBe("hash-loop");
    }
    // 第 3 次纠正后应熔断
    const r = d.shouldCircuitBreak();
    expect(r).toBe(true);
  });
});
