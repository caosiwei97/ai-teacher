#!/usr/bin/env node

import { existsSync, symlinkSync, copyFileSync, readlinkSync, unlinkSync } from "fs";
import { resolve, relative } from "path";

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, ".env");
const envExample = resolve(root, ".env.example");

// 1. .env 不存在则从 .env.example 复制
if (!existsSync(envFile)) {
  if (!existsSync(envExample)) {
    console.error("❌ .env.example 不存在，无法自动创建 .env");
    process.exit(1);
  }
  copyFileSync(envExample, envFile);
  console.log("✅ 已从 .env.example 创建 .env");
  console.log("⚠️  请编辑 .env 填入 API Key 后再继续\n");
} else {
  console.log("✅ .env 已存在");
}

// 2. 为子项目创建 .env symlink
const apps = ["apps/web", "apps/worker"];

for (const app of apps) {
  const linkPath = resolve(root, app, ".env");
  const target = relative(resolve(root, app), envFile);

  try {
    const current = readlinkSync(linkPath);
    if (current === target) {
      console.log(`✅ ${app}/.env -> ${target}`);
      continue;
    }
    // 指向错误，重建
    unlinkSync(linkPath);
  } catch {
    // 不存在或不是 symlink，继续创建
  }

  try {
    symlinkSync(target, linkPath);
    console.log(`✅ ${app}/.env -> ${target}`);
  } catch (e) {
    console.error(`❌ ${app}/.env 创建失败: ${e.message}`);
  }
}
