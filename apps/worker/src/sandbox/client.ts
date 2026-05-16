const SANDBOX_URL = process.env.OPENSANDBOX_URL ?? "http://localhost:2358";

export interface SandboxSubmission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit: number;
  memory_limit: number;
  wall_time_limit: number;
}

export interface SandboxResult {
  stdout: string | null;
  stderr: string | null;
  exit_code: number;
  time: string;
  memory: number;
  status: { id: number; description: string };
}

export async function submitCode(submission: SandboxSubmission): Promise<SandboxResult> {
  const submitRes = await fetch(`${SANDBOX_URL}/submissions?base64_encoded=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...submission,
      cpu_time_limit: submission.cpu_time_limit ?? 5,
      memory_limit: submission.memory_limit ?? 256000,
      wall_time_limit: submission.wall_time_limit ?? 10,
    }),
  });

  if (!submitRes.ok) {
    throw new Error(`Sandbox submit failed: ${submitRes.status} ${await submitRes.text()}`);
  }

  const { token } = (await submitRes.json()) as { token: string };

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const pollRes = await fetch(`${SANDBOX_URL}/submissions/${token}?base64_encoded=false`);
    if (!pollRes.ok) {
      throw new Error(`Sandbox poll failed: ${pollRes.status}`);
    }
    const result = (await pollRes.json()) as SandboxResult;
    if (result.status.id >= 3) return result;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Sandbox execution timeout");
}
