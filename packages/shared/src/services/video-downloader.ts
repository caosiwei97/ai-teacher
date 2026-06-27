import ydl from "youtube-dl-exec";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 迭代 009 Phase 2：视频获取。yt-dlp（youtube-dl-exec）封装，支持 YouTube / B站 / 直链。
// 下载到临时目录→读 Buffer→清理，交由 worker 上传 MinIO 统一走 presigned URL 喂 Qwen。
// 时长守卫避免超长视频吃满模型上下文与成本；超长提示切旗舰视觉模型（VIDEO_MODEL）。

export interface VideoMeta {
  title: string;
  durationSec?: number;
  ext: string;
}

export interface DownloadedVideo {
  buffer: Buffer;
  meta: VideoMeta;
}

const MAX_VIDEO_DURATION_SEC = Number(process.env.VIDEO_MAX_DURATION_SEC || 3600);

interface YdlInfo {
  title?: string;
  duration?: number;
  ext?: string;
}

/** 取视频元信息（title / duration / ext），不下载 */
export async function fetchVideoMeta(url: string): Promise<VideoMeta> {
  const info = (await ydl(url, {
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
  })) as YdlInfo;
  return {
    title: info.title || url,
    durationSec: info.duration,
    ext: info.ext || "mp4",
  };
}

/** 时长守卫：超 max 秒抛错。duration 缺失（无法判定）时不抛 */
export function assertDuration(meta: VideoMeta, max: number = MAX_VIDEO_DURATION_SEC): void {
  if (meta.durationSec !== undefined && meta.durationSec > max) {
    throw new Error(
      `video too long: ${meta.durationSec}s > ${max}s（调高 VIDEO_MAX_DURATION_SEC，或改 VIDEO_MODEL 为支持长视频的旗舰视觉模型如 qwen3.6-plus）`,
    );
  }
}

/** 下载视频到临时目录→读 Buffer→清理。返回 buffer + meta（统一 ext=mp4） */
export async function downloadVideo(url: string): Promise<DownloadedVideo> {
  const meta = await fetchVideoMeta(url);
  assertDuration(meta);

  const dir = await mkdtemp(join(tmpdir(), "ai-teacher-video-"));
  try {
    await ydl(url, {
      output: join(dir, "%(title).80s.%(ext)s"),
      format: "best[ext=mp4]/best",
      mergeOutputFormat: "mp4",
      noWarnings: true,
    });
    const files = await readdir(dir);
    if (files.length === 0) throw new Error("download produced no file");
    const buffer = await readFile(join(dir, files[0]!));
    return { buffer, meta: { ...meta, ext: "mp4" } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
