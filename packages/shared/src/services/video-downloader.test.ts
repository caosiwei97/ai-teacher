import { describe, it, expect, vi, beforeEach } from "vitest";

// mock youtube-dl-exec（default export）与 node:fs/promises，隔离 yt-dlp 二进制与磁盘
vi.mock("youtube-dl-exec", () => ({ default: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}));

import ydlImport from "youtube-dl-exec";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { fetchVideoMeta, assertDuration, downloadVideo } from "./video-downloader";

const ydl = vi.mocked(ydlImport);

// 迭代 009 Phase 2：video-downloader 单测。yt-dlp 二进制与磁盘 IO 均 mock，
// 覆盖 meta 提取映射、时长守卫、下载编排（临时目录→读取→清理）。

describe("video-downloader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchVideoMeta", () => {
    it("从 dumpSingleJson 映射 title/duration/ext", async () => {
      ydl.mockResolvedValue({
        title: "React 入门",
        duration: 120,
        ext: "mp4",
      } as never);
      const meta = await fetchVideoMeta("https://bilibili.com/x");
      expect(meta).toEqual({ title: "React 入门", durationSec: 120, ext: "mp4" });
      expect(ydl).toHaveBeenCalledWith("https://bilibili.com/x", expect.objectContaining({ dumpSingleJson: true, skipDownload: true }));
    });

    it("缺 title/ext 时回退默认（ext=mp4）", async () => {
      ydl.mockResolvedValue({ duration: 60 } as never);
      const meta = await fetchVideoMeta("https://youtube.com/x");
      expect(meta.title).toBe("https://youtube.com/x");
      expect(meta.ext).toBe("mp4");
    });
  });

  describe("assertDuration", () => {
    it("时长超限抛错", () => {
      expect(() => assertDuration({ title: "x", ext: "mp4", durationSec: 7200 }, 3600)).toThrow(/too long/);
    });
    it("时长未超限不抛", () => {
      expect(() => assertDuration({ title: "x", ext: "mp4", durationSec: 600 }, 3600)).not.toThrow();
    });
    it("无 duration 信息不抛（无法判定）", () => {
      expect(() => assertDuration({ title: "x", ext: "mp4" }, 3600)).not.toThrow();
    });
  });

  describe("downloadVideo", () => {
    it("下载到临时目录→读取产物→清理，返回 buffer + meta", async () => {
      // 第一次调用 dumpSingleJson 取 meta，第二次真正下载
      ydl.mockImplementation((_url, flags) => {
        if ((flags as { dumpSingleJson?: boolean }).dumpSingleJson) {
          return Promise.resolve({ title: "讲解", duration: 90, ext: "mp4" }) as never;
        }
        return Promise.resolve(undefined) as never;
      });
      (mkdtemp as ReturnType<typeof vi.fn>).mockResolvedValue("/tmp/viddir");
      (readdir as ReturnType<typeof vi.fn>).mockResolvedValue(["video.mp4"]);
      (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from("binary"));
      (rm as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const r = await downloadVideo("https://bilibili.com/x");
      expect(r.meta).toEqual({ title: "讲解", durationSec: 90, ext: "mp4" });
      expect(r.buffer.toString()).toBe("binary");
      // 下载调用带 output 模板
      const downloadCall = ydl.mock.calls.find(([, f]) => !(f as { dumpSingleJson?: boolean }).dumpSingleJson);
      expect(downloadCall?.[1]).toMatchObject({ output: expect.stringContaining("viddir"), mergeOutputFormat: "mp4" });
      // 清理临时目录
      expect(rm).toHaveBeenCalledWith("/tmp/viddir", { recursive: true, force: true });
    });

    it("下载产物为空时报错", async () => {
      ydl.mockResolvedValue({ title: "x", ext: "mp4", duration: 30 } as never);
      (mkdtemp as ReturnType<typeof vi.fn>).mockResolvedValue("/tmp/viddir");
      (readdir as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (rm as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      await expect(downloadVideo("https://x")).rejects.toThrow(/no file/);
    });

    it("超时长视频在下载前即被守卫拦截", async () => {
      ydl.mockResolvedValue({ title: "x", ext: "mp4", duration: 99999 } as never);
      await expect(downloadVideo("https://x")).rejects.toThrow(/too long/);
    });
  });
});
