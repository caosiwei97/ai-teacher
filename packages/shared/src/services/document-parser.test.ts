import { describe, it, expect } from "vitest";
import { parseMarkdown, stripHtml, extractJinaTitle } from "./document-parser";

describe("document-parser", () => {
  describe("parseMarkdown", () => {
    it("trim 首尾空白", () => {
      expect(parseMarkdown("  \n# 标题\n正文  ")).toBe("# 标题\n正文");
    });

    it("空字符串", () => {
      expect(parseMarkdown("   ")).toBe("");
    });
  });

  describe("stripHtml", () => {
    it("去除标签 + 解码实体", () => {
      const html = "<p>你好&nbsp;世界 &amp; <b>AI</b>&lt;Teacher&gt;</p>";
      expect(stripHtml(html)).toBe("你好 世界 & AI <Teacher>");
    });

    it("移除 script / style 内容", () => {
      const html = "<style>.x{color:red}</style><script>alert(1)</script><p>正文</p>";
      expect(stripHtml(html)).toBe("正文");
    });

    it("折叠多余空白", () => {
      const html = "<div>a</div>  \n  <div>b</div>";
      expect(stripHtml(html)).toBe("a b");
    });

    it("解码引号实体", () => {
      expect(stripHtml("<p>&quot;引号&quot; &#39;撇&#39;</p>")).toBe(`"引号" '撇'`);
    });
  });

  describe("extractJinaTitle", () => {
    it("提取 Title 行", () => {
      const jina = "Title: React 官方文档\nURL Source: https://react.dev\nMarkdown Content:\n...";
      expect(extractJinaTitle(jina)).toBe("React 官方文档");
    });

    it("无 Title 行返回 null", () => {
      expect(extractJinaTitle("没有标题行的内容")).toBeNull();
    });
  });
});
