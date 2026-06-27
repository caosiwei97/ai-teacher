import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { uploadVideoFile, understandVideo, buildDigestPrompt } from "./video-understanding";

// 迭代 009 Phase 2：video-understanding 单测（上传路径）。mock global fetch，
// 覆盖 getPolicy/upload/understand 三步的端点/鉴权/表单/响应解析/错误处理。

const POLICY = {
  policy: "p==",
  signature: "s=",
  upload_dir: "dashscope-instant/acc/2026/dir",
  upload_host: "https://oss-upload.example.com",
  oss_access_key_id: "LTAxxx",
  x_oss_object_acl: "private",
  x_oss_forbid_overwrite: "true",
};

describe("video-understanding", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.DASHSCOPE_API_KEY = "sk-test";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example.com/v1";
    process.env.VIDEO_MODEL = "qwen3.5-omni-plus";
  });

  afterEach(() => {
    for (const k of ["DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL", "VIDEO_MODEL"]) {
      if (k in origEnv) process.env[k] = origEnv[k];
      else delete process.env[k];
    }
    vi.restoreAllMocks();
  });

  describe("uploadVideoFile", () => {
    it("getPolicy → POST OSS → 返回 oss:// URL", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (String(url).includes("/uploads?")) {
          return new Response(JSON.stringify({ data: POLICY }), { status: 200 });
        }
        return new Response("", { status: 200 });
      });

      const url = await uploadVideoFile(Buffer.from("video-bytes"), "lec.mp4", "qwen3.5-omni-plus");
      expect(url).toBe(`oss://${POLICY.upload_dir}/lec.mp4`);

      // getPolicy 调用带 model
      const policyCallUrl = String(fetchMock.mock.calls[0][0]);
      expect(policyCallUrl).toContain("/uploads?action=getPolicy&model=qwen3.5-omni-plus");

      // 上传调用打到 upload_host，POST + FormData
      const uploadUrl = String(fetchMock.mock.calls[1][0]);
      const uploadInit = fetchMock.mock.calls[1][1] as RequestInit;
      expect(uploadUrl).toBe(POLICY.upload_host);
      expect(uploadInit.method).toBe("POST");
      expect(uploadInit.body).toBeInstanceOf(FormData);
    });

    it("getPolicy 非 2xx 抛错", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("policy err", { status: 500 }));
      await expect(uploadVideoFile(Buffer.from("x"), "v.mp4", "m")).rejects.toThrow(/getUploadPolicy 500/);
    });

    it("OSS 上传非 2xx 抛错", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (String(url).includes("/uploads?")) {
          return new Response(JSON.stringify({ data: POLICY }), { status: 200 });
        }
        return new Response("oss err", { status: 403 });
      });
      await expect(uploadVideoFile(Buffer.from("x"), "v.mp4", "m")).rejects.toThrow(/uploadVideoFile 403/);
    });
  });

  describe("understandVideo", () => {
    function mockOk(content: string) {
      return vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
      );
    }

    it("带 X-DashScope-OssResourceResolve 头 + video_url 调用，返回 content", async () => {
      const fetchMock = mockOk("## 主题\n讲解…");
      const r = await understandVideo({ videoUrl: "oss://dir/v.mp4" });

      expect(r.text).toBe("## 主题\n讲解…");
      expect(r.model).toBe("qwen3.5-omni-plus");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://dashscope.example.com/v1/chat/completions");
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers["X-DashScope-OssResourceResolve"]).toBe("enable");
      expect(headers.Authorization).toBe("Bearer sk-test");
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe("qwen3.5-omni-plus");
      expect(body.messages[0].content).toContainEqual({
        type: "video_url",
        video_url: { url: "oss://dir/v.mp4" },
      });
      expect(body.messages[0].content.find((p: { type: string }) => p.type === "text").text).toContain("教学");
    });

    it("opts.model 覆盖默认", async () => {
      const fetchMock = mockOk("x");
      await understandVideo({ videoUrl: "oss://dir/v.mp4", model: "qwen3.6-plus" });
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.model).toBe("qwen3.6-plus");
    });

    it("非 2xx 抛错含状态码", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
      await expect(understandVideo({ videoUrl: "oss://dir/v.mp4" })).rejects.toThrow(/400/);
    });

    it("空 content 抛错", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }),
      );
      await expect(understandVideo({ videoUrl: "oss://dir/v.mp4" })).rejects.toThrow(/empty digest/);
    });

    it("缺 API key 抛错", async () => {
      delete process.env.DASHSCOPE_API_KEY;
      await expect(understandVideo({ videoUrl: "oss://dir/v.mp4" })).rejects.toThrow(/DASHSCOPE_API_KEY/);
    });
  });

  describe("buildDigestPrompt", () => {
    it("含教学分析指令与视觉内容描述要求", () => {
      const p = buildDigestPrompt();
      expect(p).toContain("教学");
      expect(p).toMatch(/板书|代码|图表|演示/);
    });
  });
});
