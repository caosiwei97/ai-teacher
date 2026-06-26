#!/usr/bin/env node
// 文档-代码一致性检查（迭代 043）
// 用法: pnpm check:docs
// 退出码: 0 全部通过, 1 有不一致

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const results = [];

// 检查 1: Prisma Schema ↔ 技术架构.md 数据模型
function checkPrisma() {
  const schema = read("packages/db/prisma/schema.prisma");
  const schemaModels = [...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1]);

  const archDoc = read("docs/设计/技术架构.md");
  const prismaBlocks = [...archDoc.matchAll(/```prisma\n([\s\S]*?)```/g)]
    .map((m) => m[1])
    .join("\n");
  const docModels = [...prismaBlocks.matchAll(/^model (\w+)/gm)].map((m) => m[1]);

  const schemaSet = new Set(schemaModels);
  const docSet = new Set(docModels);
  const missingInDoc = [...schemaSet].filter((m) => !docSet.has(m));
  const missingInSchema = [...docSet].filter((m) => !schemaSet.has(m));

  return {
    name: "Prisma Schema ↔ 技术架构.md",
    passed: missingInDoc.length === 0 && missingInSchema.length === 0,
    message:
      missingInDoc.length === 0 && missingInSchema.length === 0
        ? `model 一致（${schemaModels.length} 个）`
        : `文档缺 model: [${missingInDoc.join(", ")}] / schema 缺: [${missingInSchema.join(", ")}]`,
  };
}

// 检查 2: .env.example ↔ 技术架构.md 环境变量
function checkEnv() {
  const envFile = read(".env.example");
  const envKeys = [...envFile.matchAll(/^(\w+)=/gm)].map((m) => m[1]);

  const archDoc = read("docs/设计/技术架构.md");
  const envSection = archDoc.split("## 8. 环境变量")[1]?.split(/\n## /)[0] ?? "";

  const missing = envKeys.filter((k) => !envSection.includes(k));
  return {
    name: ".env.example ↔ 技术架构.md 环境变量",
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? `${envKeys.length} 个 KEY 一致`
        : `文档环境变量章节缺 KEY: [${missing.join(", ")}]`,
  };
}

// 检查 3: API 路由 ↔ API接口.md（端点存在性，弱检查）
function checkRoutes() {
  const routeFiles = readdirSync("apps/server/src/routes")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(".ts", ""));
  const apiDoc = read("docs/设计/API接口.md");
  const endpoints = [
    ...apiDoc.matchAll(/(?:POST|GET|PATCH|DELETE|PUT)\s+\/api\/\S+/g),
  ].map((m) => m[0].trim());

  return {
    name: "API 路由 ↔ API接口.md",
    passed: endpoints.length >= routeFiles.length,
    message:
      `routes 文件 ${routeFiles.length} 个 / 文档端点 ${endpoints.length} 个` +
      (endpoints.length >= routeFiles.length
        ? ""
        : ` ⚠️ 文档端点数少于路由文件数，可能漏文档`),
  };
}

// 检查 4: Agent 工具 ↔ Prompt设计.md
function checkTools() {
  const toolFiles = readdirSync("apps/worker/src/agent/tools")
    .filter(
      (f) =>
        f.endsWith(".ts") &&
        !f.endsWith(".test.ts") &&
        f !== "index.ts" &&
        f !== "create-tools.ts",
    )
    .map((f) => f.replace(".ts", ""));
  const promptDoc = read("docs/设计/Prompt设计.md");
  const promptLower = promptDoc.toLowerCase();

  const missing = toolFiles.filter((stem) => {
    const needle = stem.replace(/-/g, "").toLowerCase();
    return !promptLower.includes(needle);
  });
  return {
    name: "Agent 工具 ↔ Prompt设计.md",
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? `${toolFiles.length} 个工具均已文档化`
        : `文档缺工具: [${missing.join(", ")}]`,
  };
}

// 检查 5: 端口表 README ↔ 技术架构.md
function checkPorts() {
  const extractPorts = (doc, marker) => {
    const section = doc.split(marker)[1]?.split(/\n## /)[0] ?? "";
    return new Set([...section.matchAll(/\|\s(\d{4,5})\s\|/g)].map((m) => m[1]));
  };
  const readmePorts = extractPorts(read("README.md"), "## 服务端口");
  const archPorts = extractPorts(read("docs/设计/技术架构.md"), "## 6. 服务端口");

  const missingInReadme = [...archPorts].filter((p) => !readmePorts.has(p));
  const missingInArch = [...readmePorts].filter((p) => !archPorts.has(p));
  return {
    name: "端口表 README ↔ 技术架构.md",
    passed: missingInReadme.length === 0 && missingInArch.length === 0,
    message:
      missingInReadme.length === 0 && missingInArch.length === 0
        ? `端口一致（${readmePorts.size} 个）`
        : `README 缺: [${missingInReadme.join(", ")}] / 技术架构缺: [${missingInArch.join(", ")}]`,
  };
}

// 检查 6: AGENTS.md §3.1 索引的 references 文件存在性
function checkReferencesExist() {
  const agentsMd = read("AGENTS.md");
  const refs = [
    ...agentsMd.matchAll(/`\.agents\/references\/([^`]+\.md)`/g),
  ].map((m) => m[1]);
  const missing = refs.filter(
    (r) => !existsSync(join(ROOT, ".agents/references", r)),
  );
  return {
    name: "AGENTS.md 索引的 references 文件存在性",
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? `${refs.length} 个 references 文件均存在`
        : `缺失: [${missing.join(", ")}]`,
  };
}

results.push(checkPrisma());
results.push(checkEnv());
results.push(checkRoutes());
results.push(checkTools());
results.push(checkPorts());
results.push(checkReferencesExist());

console.log("\n📄 文档-代码一致性检查\n");
for (const r of results) {
  console.log(`${r.passed ? "✅" : "❌"} ${r.name}`);
  console.log(`   ${r.message}\n`);
}

const failed = results.filter((r) => !r.passed);
if (failed.length > 0) {
  console.log(`❌ ${failed.length} 项检查未通过\n`);
  process.exit(1);
}
console.log("✅ 全部检查通过\n");
