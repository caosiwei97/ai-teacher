#!/usr/bin/env node
// 依赖方向计算性传感器（迭代 042）
// ArchUnit 风格的结构化测试：把 AGENTS.md §5 项目结构的依赖方向从 AI 自觉遵守升级为工具强制
// 用法: pnpm check:deps   退出码: 0 通过, 1 有违规
//
// 合法依赖方向矩阵：
//   apps/web    → packages/shared
//   apps/server → packages/shared, packages/db
//   apps/worker → packages/shared, packages/db
//   packages/shared → 叶子包（不依赖任何内部包）
//   packages/db     → 叶子包（不依赖任何内部包）
//
// 采用自定义脚本而非 dependency-cruiser：后者要求 Node ^22||^24||>=26，
// 与 CI（Node 20）/ 本地（Node 25）均不兼容；自定义脚本无 Node 版本依赖。

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const ROOT = process.cwd();

// from 包 → 允许依赖的内部包列表
const ALLOWED = {
  "apps/web": ["packages/shared"],
  "apps/server": ["packages/shared", "packages/db"],
  "apps/worker": ["packages/shared", "packages/db"],
  "packages/shared": [],
  "packages/db": [],
};

const PKG_ROOTS = Object.keys(ALLOWED);

// 已知技术债白名单（迭代 042 传感器发现的 server↔worker 共享代码逃逸）
// 这些违规已记录在 决策记录.md ADR，待后续迭代「依赖方向治理」归位到共享包后逐项移除
// 匹配规则：fromFile 完全相等 且 spec 包含 specMatch 子串
const KNOWN_VIOLATIONS = [
  {
    from: "apps/server/src/routes/llm-config.ts",
    specMatch: "provider-registry",
    reason: "server/worker 共享 LLM provider 构造，待依赖方向治理迭代归位共享包",
  },
  {
    from: "apps/server/src/routes/quick-question.ts",
    specMatch: "provider-registry",
    reason: "server/worker 共享 LLM provider 构造，待依赖方向治理迭代归位共享包",
  },
  {
    from: "apps/server/src/routes/suggest-reply.ts",
    specMatch: "provider-registry",
    reason: "server/worker 共享 LLM provider 构造，待依赖方向治理迭代归位共享包",
  },
  {
    from: "apps/server/src/routes/diagnostic.ts",
    specMatch: "agent/diagnostic",
    reason: "诊断流程 server 同步调用 worker agent，待依赖方向治理迭代解耦归位",
  },
  {
    from: "apps/server/src/routes/session-detail.ts",
    specMatch: "profile-service",
    reason: "server/worker 共享 profile 读写，待依赖方向治理迭代归位共享包",
  },
];

function matchKnown(fromRel, spec) {
  return KNOWN_VIOLATIONS.find(
    (k) => k.from === fromRel && spec.includes(k.specMatch),
  );
}

// 判断文件所属的受检包根
function packageRootOf(absPath) {
  const rel = relative(ROOT, absPath);
  for (const key of PKG_ROOTS) {
    if (rel === key || rel.startsWith(key + "/")) return key;
  }
  return null;
}

// 收集目录下所有 .ts/.tsx 源文件（跳过 node_modules/dist/.vite/类型声明）
function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".vite" || entry === "coverage") continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) acc.push(p);
  }
  return acc;
}

// 提取文件中所有 import/export 模块指定符
const RE_FROM = /(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g;
const RE_SIDE = /\bimport\s*['"]([^'"]+)['"]/g;
const RE_DYN = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function importSpecs(content) {
  const specs = new Set();
  for (const re of [RE_FROM, RE_SIDE, RE_DYN]) {
    for (const m of content.matchAll(re)) specs.add(m[1]);
  }
  return [...specs];
}

// 将指定符解析为内部包根（packages/shared 等），外部或包内相对返回 null
function resolveInternalPkg(spec, fromFile) {
  if (spec === "@ai-teacher/shared" || spec.startsWith("@ai-teacher/shared/")) return "packages/shared";
  if (spec === "@ai-teacher/db" || spec.startsWith("@ai-teacher/db/")) return "packages/db";
  if (spec.startsWith(".")) {
    // 相对导入：解析后判断落在哪个受检包
    const target = resolve(dirname(fromFile), spec);
    if (!existsSync(target)) {
      // 可能省略扩展名，尝试常见后缀
      for (const ext of [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"]) {
        if (existsSync(target + ext)) return packageRootOf(target + ext);
      }
    }
    return packageRootOf(target);
  }
  return null; // 外部 bare import（react、hono 等）
}

const files = [
  ...walk(join(ROOT, "apps")),
  ...walk(join(ROOT, "packages")),
];

const violations = [];
const knownViolations = [];
for (const file of files) {
  const fromPkg = packageRootOf(file);
  if (!fromPkg) continue;
  const content = readFileSync(file, "utf8");
  for (const spec of importSpecs(content)) {
    const toPkg = resolveInternalPkg(spec, file);
    if (!toPkg || toPkg === fromPkg) continue; // 外部依赖或包内自引用
    if (ALLOWED[fromPkg].includes(toPkg)) continue;
    const fromRel = relative(ROOT, file);
    const known = matchKnown(fromRel, spec);
    if (known) {
      knownViolations.push({ from: fromRel, fromPkg, toPkg, spec, reason: known.reason });
    } else {
      violations.push({ from: fromRel, fromPkg, toPkg, spec });
    }
  }
}

console.log("\n🔗 依赖方向检查（迭代 042 计算性传感器）\n");
console.log(`扫描 ${files.length} 个源文件\n`);

if (knownViolations.length > 0) {
  console.log(`⚠️  ${knownViolations.length} 处已知技术债（已豁免，见 决策记录.md ADR）：\n`);
  for (const v of knownViolations) {
    console.log(`   ${v.from}`);
    console.log(`     → ${v.spec}（目标 ${v.toPkg}）— ${v.reason}\n`);
  }
}

if (violations.length === 0) {
  console.log(`✅ 无新增依赖方向违规\n`);
  process.exit(0);
}

for (const v of violations) {
  const hint =
    v.fromPkg === "apps/web"
      ? "apps/web 只能依赖 packages/shared"
      : v.fromPkg.startsWith("apps/")
        ? `${v.fromPkg} 只能依赖 packages/shared, packages/db`
        : `${v.fromPkg} 是叶子包，不能依赖任何内部包`;
  console.log(`❌ ${v.from}`);
  console.log(`   非法依赖 → ${v.spec}（目标 ${v.toPkg}）`);
  console.log(`   规则：${hint}\n`);
}
console.log(`❌ ${violations.length} 处新增依赖方向违规\n`);
process.exit(1);
