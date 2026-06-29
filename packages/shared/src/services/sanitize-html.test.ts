import { describe, it, expect } from "vitest";
import { sanitizeInteractiveHtml } from "./sanitize-html";

describe("sanitizeInteractiveHtml", () => {
  it("移除带 src 的外部 script 标签", () => {
    const html = '<script src="https://evil.js"></script><p>ok</p>';
    const r = sanitizeInteractiveHtml(html);
    expect(r.degraded).toBe(false);
    expect(r.html).not.toContain("evil.js");
    expect(r.html).not.toContain("<script");
    expect(r.html).toContain("<p>ok</p>");
  });

  it("保留内联 script（互动课需要执行交互逻辑）", () => {
    const html = '<script>const x = 1;</script><p>ok</p>';
    const r = sanitizeInteractiveHtml(html);
    expect(r.html).toContain("<script>const x = 1;</script>");
  });

  it("移除 javascript: 协议", () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const r = sanitizeInteractiveHtml(html);
    expect(r.html).not.toContain("javascript:");
    expect(r.html).toContain('href="#"');
  });

  it("移除 on* 事件属性", () => {
    const html = '<div onclick="evil()" onload="evil2()">x</div>';
    const r = sanitizeInteractiveHtml(html);
    expect(r.html).not.toContain("onclick");
    expect(r.html).not.toContain("onload");
    expect(r.html).toContain(">x<");
  });

  it("超大 HTML（>100KB）标记降级，不净化", () => {
    const html = "x".repeat(100 * 1024 + 1);
    const r = sanitizeInteractiveHtml(html);
    expect(r.degraded).toBe(true);
    expect(r.reason).toBe("oversize");
  });

  it("边界：恰好 100KB 不降级", () => {
    const html = "x".repeat(100 * 1024);
    const r = sanitizeInteractiveHtml(html);
    expect(r.degraded).toBe(false);
  });

  it("正常互动 HTML 不降级，内容保留", () => {
    const html =
      '<div><button id="b">点我</button><script>document.getElementById("b").addEventListener("click",()=>{})</script></div>';
    const r = sanitizeInteractiveHtml(html);
    expect(r.degraded).toBe(false);
    expect(r.html).toContain("点我");
    expect(r.html).toContain("<script>");
  });
});
