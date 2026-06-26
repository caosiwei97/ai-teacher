// 迭代 009：文档分块（纯函数，TDD 覆盖）。
// 段落感知 + 段内滑窗 overlap，为 RAG embedding 提供语义连贯的 chunk。

export interface Chunk {
  content: string;
  tokenCount: number;
  index: number;
}

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

const DEFAULT_MAX_CHARS = 500;
const DEFAULT_OVERLAP = 100;

// 粗略 token 估算：中文约 1 字 ≈ 1 token、英文约 4 字符 ≈ 1 token，取折中 /3。
// 仅用于检索上下文预算，非精确计数。
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const normalized = text.trim();
  if (!normalized) return [];

  // 步长至少 1，防止 overlap >= maxChars 时死循环
  const step = Math.max(1, maxChars - overlap);

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let index = 0;

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      chunks.push({ content: para, tokenCount: estimateTokens(para), index: index++ });
      continue;
    }
    let start = 0;
    while (start < para.length) {
      const end = Math.min(start + maxChars, para.length);
      const slice = para.slice(start, end);
      chunks.push({ content: slice, tokenCount: estimateTokens(slice), index: index++ });
      if (end >= para.length) break;
      start += step;
    }
  }

  return chunks;
}
