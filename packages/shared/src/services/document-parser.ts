import { PDFParse } from "pdf-parse";

// 迭代 009：文档解析。PDF（pdf-parse v2）/ Markdown（直读）/ URL（Jina Reader 优先，兜底 HTML 清洗）。
// PDF 复杂排版后续可升级 Docling；URL 兜底质量不足时再加 Readability + Turndown。

export interface ParsedDocument {
  text: string;
  title: string;
}

/** PDF 字节 → 纯文本 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

/** Markdown 直读（已是纯文本） */
export function parseMarkdown(content: string): string {
  return content.trim();
}

/** URL → markdown 文本；Jina Reader 优先，失败兜底直接抓 HTML 去标签 */
export async function parseUrl(url: string): Promise<ParsedDocument> {
  // Jina Reader（无依赖，质量好，返回 markdown）
  try {
    const res = await fetch(`https://r.jina.ai/${url}`);
    if (res.ok) {
      const raw = (await res.text()).trim();
      if (raw.length > 100) {
        return { text: raw, title: extractJinaTitle(raw) ?? url };
      }
    }
  } catch {
    // 网络异常 → 走兜底
  }

  // 兜底：直接抓 HTML，去标签清洗
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch URL failed: ${res.status} ${url}`);
  return { text: stripHtml(await res.text()), title: url };
}

/** 从 Jina Reader 输出提取 Title 行（纯函数，便于测试） */
export function extractJinaTitle(jinaText: string): string | null {
  const m = jinaText.match(/^Title:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

/** HTML → 纯文本：去 script/style/标签 + 解码常见实体 + 折叠空白（纯函数，便于测试） */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
