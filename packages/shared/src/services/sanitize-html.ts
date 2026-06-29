// 迭代 050②：互动产物（interactive block）HTML 净化。
// iframe sandbox="allow-scripts" 已隔离 DOM/cookie，本函数做基本净化兜底：
// 移除外部脚本、javascript: 协议、on* 事件属性；超大 HTML 标记降级由前端走文字兜底。

const MAX_HTML_SIZE = 100 * 1024; // 100KB

export interface SanitizeResult {
  html: string;
  degraded: boolean;
  reason?: string;
}

export function sanitizeInteractiveHtml(raw: string): SanitizeResult {
  if (raw.length > MAX_HTML_SIZE) {
    return { html: raw, degraded: true, reason: "oversize" };
  }

  let html = raw;
  // 移除带 src 的 script 标签（外部脚本）；保留内联 script（互动逻辑需要）
  html = html.replace(
    /<script\b[^>]*\bsrc\s*=\s*["'][^"']*["'][^>]*>\s*<\/script>/gi,
    "",
  );
  // 中和 javascript: 协议（href/src）→ "#"
  html = html.replace(/(href|src)\s*=\s*(["'])javascript:[^"']*["']/gi, '$1=$2#$2');
  // 移除 on* 事件属性（onclick/onload 等）
  html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");

  return { html, degraded: false };
}
