// 迭代 009 Phase 2：视频理解。
// 架构（spike 实证，2026-06-27）：视频字节 → 上传 DashScope 文件 API（getPolicy→OSS）拿 oss:// 临时 URL
// → 调 Qwen3.5-Omni（OpenAI 兼容端点，带 X-DashScope-OssResourceResolve 头解析 oss://）→ 教学向 digest 文本。
// digest 即 Phase 1 的 Source.content，下游 chunk→embed→store 零改动复用。
// base64 内联体积受限（38MB→50MB 触发 413），上传路径支持 ~100MB，为生产主路径。

const UPLOADS_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/uploads";

export interface VideoDigest {
  text: string;
  model: string;
}

// 教学向 digest prompt：逐段讲解 + 视觉内容描述（板书/代码/图表）+ 概念提炼 + 疑难点。
const DIGEST_PROMPT = `你是一位资深教学分析师。请仔细观看并分析这段教学视频，产出结构化的中文学习摘要，供后续检索式教学使用。要求：
1. 按内容主题逐段讲解要点，保留关键步骤、推导与因果逻辑。
2. 描述视频中出现的板书、代码、图表、公式、屏幕演示等重要视觉内容，关键文字尽量原文转述。
3. 提炼核心概念、定义与术语，用清晰准确的自然语言解释。
4. 标注学习者容易困惑、适合追问的疑难点。
输出纯文本，分节用「## 」标题。不要寒暄，不要复述本指令。`;

export function buildDigestPrompt(): string {
  return DIGEST_PROMPT;
}

interface DashScopeConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function resolveConfig(): DashScopeConfig {
  const baseUrl = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const model = process.env.VIDEO_MODEL || "qwen3.5-omni-plus";
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY not set. Configure it in .env (see .env.example).");
  }
  return { baseUrl, apiKey, model };
}

interface UploadPolicy {
  policy: string;
  signature: string;
  upload_dir: string;
  upload_host: string;
  oss_access_key_id: string;
  x_oss_object_acl: string;
  x_oss_forbid_overwrite: string;
}

/** 获取 DashScope 文件上传凭证（按 主账号+model 维度，100QPS，48h 有效）*/
async function getUploadPolicy(apiKey: string, model: string): Promise<UploadPolicy> {
  const res = await fetch(`${UPLOADS_ENDPOINT}?action=getPolicy&model=${model}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`getUploadPolicy ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: UploadPolicy };
  if (!data.data) throw new Error("getUploadPolicy: missing data in response");
  return data.data;
}

/**
 * 上传视频字节到 DashScope 临时存储，返回 oss:// URL（48h 有效，绑定 model + 主账号）。
 * 文件名仅用于 OSS key 去重，不影响内容。
 */
export async function uploadVideoFile(buffer: Buffer, filename: string, model: string): Promise<string> {
  const { apiKey } = resolveConfig();
  const policy = await getUploadPolicy(apiKey, model);
  const key = `${policy.upload_dir}/${filename}`;

  const form = new FormData();
  form.append("OSSAccessKeyId", policy.oss_access_key_id);
  form.append("Signature", policy.signature);
  form.append("policy", policy.policy);
  form.append("key", key);
  form.append("x-oss-object-acl", policy.x_oss_object_acl);
  form.append("x-oss-forbid-overwrite", policy.x_oss_forbid_overwrite);
  form.append("success_action_status", "200");
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);

  const res = await fetch(policy.upload_host, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`uploadVideoFile ${res.status}: ${detail.slice(0, 300)}`);
  }
  return `oss://${key}`;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * 调 Qwen 视频模型分析视频，返回教学向 digest 文本。
 * videoUrl 通常为 uploadVideoFile 返回的 oss:// URL（需 X-DashScope-OssResourceResolve 头解析）；
 * 也可传公网 http(s) URL 或 data: URL（同样发送该头，无害）。
 */
export async function understandVideo(opts: {
  videoUrl: string;
  model?: string;
}): Promise<VideoDigest> {
  const { baseUrl, apiKey, model: defaultModel } = resolveConfig();
  const model = opts.model ?? defaultModel;

  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "video_url", video_url: { url: opts.videoUrl } },
          { type: "text", text: DIGEST_PROMPT },
        ],
      },
    ],
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-DashScope-OssResourceResolve": "enable",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`video-understanding API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("video-understanding: empty digest (no content in response)");

  return { text, model };
}
