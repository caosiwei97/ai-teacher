import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from 'zod';
import { submitCode } from "../../sandbox/client.js";
import { getLanguageName } from "../../sandbox/languages.js";

const DANGEROUS_PATTERNS = [
  /import\s+os\b/,
  /import\s+socket\b/,
  /require\s*\(\s*["']fs["']\s*\)/,
  /require\s*\(\s*["']child_process["']\s*\)/,
  /subprocess\./,
  /process\.exit/,
  /__import__/,
];

export const executeCodeTool: ToolDefinition = {
  name: "executeCode",
  description: "在安全沙箱中执行学生代码，返回运行结果（stdout/stderr/exitCode）",
  inputSchema: z.object({
    sourceCode: z.string().describe("要执行的代码"),
    languageId: z.number().describe("Judge0 语言 ID（如 71=Python 3, 63=JavaScript, 62=Java）"),
    stdin: z.string().optional().describe("标准输入"),
    expectedOutput: z.string().optional().describe("期望输出，用于自动判定"),
  }),
  execute: async (params, _ctx) => {
    const p = params as {
      sourceCode: string;
      languageId: number;
      stdin?: string;
      expectedOutput?: string;
    };

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(p.sourceCode)) {
        return {
          success: false,
          error: "代码包含不允许的操作（文件系统/网络/子进程）",
          stdout: "",
          stderr: "安全检查未通过：代码包含不允许的操作系统调用",
          exitCode: -1,
          language: getLanguageName(p.languageId),
          code: p.sourceCode,
        };
      }
    }

    try {
      const result = await submitCode({
        source_code: p.sourceCode,
        language_id: p.languageId,
        stdin: p.stdin,
        expected_output: p.expectedOutput,
        cpu_time_limit: 5,
        memory_limit: 256000,
        wall_time_limit: 10,
      });

      return {
        success: result.status.id === 3 && result.exit_code === 0,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: result.exit_code,
        time: result.time,
        memory: result.memory,
        status: result.status.description,
        language: getLanguageName(p.languageId),
        code: p.sourceCode,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "执行失败",
        stdout: "",
        stderr: e instanceof Error ? e.message : "执行失败",
        exitCode: -1,
        language: getLanguageName(p.languageId),
        code: p.sourceCode,
      };
    }
  },
  promptSnippet: `**executeCode 工具**：你可以在安全沙箱中运行学生的代码。支持 Python(71)、JavaScript(63)、Java(62)、C++(54)、TypeScript(74) 等语言。资源限制：CPU 5秒、内存 256MB、墙钟 10秒。运行前会自动检查安全问题（禁止文件系统、网络、子进程操作）。`,
  promptGuidelines: [
    "当学生写了代码时，主动运行验证结果",
    "运行前先肉眼检查是否安全，避免不必要的 API 调用",
    "如果执行失败，分析 stderr 并给出具体修改建议",
    "对比 stdout 和期望输出时，注意空白字符和换行的差异",
  ],
};
