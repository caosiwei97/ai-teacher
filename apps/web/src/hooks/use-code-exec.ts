
import { useState, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:38422";

export interface CodeExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  time?: string;
  memory?: number;
  status?: string;
}

interface UseCodeExecReturn {
  execute: (
    sourceCode: string,
    languageId: number,
    stdin?: string,
    llmConfigId?: string,
  ) => Promise<CodeExecResult | null>;
  result: CodeExecResult | null;
  isExecuting: boolean;
  error: string | null;
}

export function useCodeExec(): UseCodeExecReturn {
  const [result, setResult] = useState<CodeExecResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (sourceCode: string, languageId: number, stdin?: string, llmConfigId?: string) => {
      setIsExecuting(true);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/api/sandbox/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_code: sourceCode,
            language_id: languageId,
            stdin,
            ...(llmConfigId ? { llmConfigId } : {}),
          }),
        });

        if (!res.ok) {
          throw new Error(`执行失败: ${res.status}`);
        }

        const data = (await res.json()) as CodeExecResult;
        setResult(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "执行失败";
        setError(msg);
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [],
  );

  return { execute, result, isExecuting, error };
}
