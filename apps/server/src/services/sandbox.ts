const OPENSANDBOX_URL = process.env.OPENSANDBOX_URL ?? "http://localhost:2358";
const SANDBOX_IMAGE = "opensandbox/code-interpreter:latest";
const EXECD_PORT = 44772;

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  cpp: "cpp",
};

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

interface SandboxInfo {
  id: string;
  status: { state: string };
}

let cachedSandboxId: string | null = null;
let cachedExecdUrl: string | null = null;

function languageIdToName(id: number): string {
  const map: Record<number, string> = { 71: "python", 63: "javascript", 74: "typescript", 62: "java", 54: "cpp" };
  return map[id] ?? "python";
}

/** OpenSandbox endpoint uses "host.docker.internal" (Docker-only DNS); we map to localhost. */
function toHostUrl(endpoint: string): string {
  const match = endpoint.match(/:(\d+)/);
  if (!match) throw new Error(`Cannot parse endpoint port: ${endpoint}`);
  return `localhost:${match[1]}`;
}

/**
 * Build environment variables to inject into sandbox containers.
 *
 * ⚠️ SECURITY WARNING — API Key Exposure
 *
 * Current: single-user local app — injecting API keys is safe (user's own machine, own keys).
 *
 * Future (web service / multi-user): DO NOT inject raw keys. User code can read env vars
 * via `os.environ` and exfiltrate them. Instead, implement an API proxy on the server:
 *   1. Sandbox code calls `http://host.docker.internal:38422/api/proxy/llm` (no key needed)
 *   2. Server injects the key server-side and forwards the request
 *   3. Optionally add rate limiting / quota per session
 *
 * TODO(web-service): Replace direct key injection with server-side API proxy.
 */
interface SandboxLlmConfig {
  apiKey: string;
  baseUrl?: string;
}

function buildSandboxEnv(llmConfig?: SandboxLlmConfig): Record<string, string> {
  const env: Record<string, string> = {};

  const apiKey = llmConfig?.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = llmConfig?.baseUrl ?? process.env.OPENAI_BASE_URL;

  if (apiKey) env.OPENAI_API_KEY = apiKey;
  if (baseUrl) env.OPENAI_BASE_URL = baseUrl;

  return env;
}

async function createSandbox(llmConfig?: SandboxLlmConfig): Promise<string> {
  const res = await fetch(`${OPENSANDBOX_URL}/v1/sandboxes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: { uri: SANDBOX_IMAGE },
      entrypoint: ["/opt/opensandbox/code-interpreter.sh"],
      env: buildSandboxEnv(llmConfig),
      timeout: 86400,
      resourceLimits: { cpu: "1", memory: "2Gi" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create sandbox: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as SandboxInfo;
  return data.id;
}

async function waitForSandbox(id: string, maxWaitMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${OPENSANDBOX_URL}/v1/sandboxes/${id}`);
    if (!res.ok) throw new Error(`Failed to poll sandbox: ${res.status}`);
    const data = (await res.json()) as SandboxInfo;
    if (data.status.state === "Running") return;
    if (data.status.state === "Failed") throw new Error("Sandbox failed to start");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Sandbox startup timeout");
}

async function getExecdUrl(sandboxId: string): Promise<string> {
  const res = await fetch(`${OPENSANDBOX_URL}/v1/sandboxes/${sandboxId}/endpoints/${EXECD_PORT}`);
  if (!res.ok) throw new Error(`Failed to get execd endpoint: ${res.status}`);
  const data = (await res.json()) as { endpoint: string };
  return toHostUrl(data.endpoint);
}

export async function ensureSandbox(llmConfig?: SandboxLlmConfig): Promise<string> {
  if (cachedExecdUrl && cachedSandboxId) {
    const res = await fetch(`${OPENSANDBOX_URL}/v1/sandboxes/${cachedSandboxId}`).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as SandboxInfo;
      if (data.status.state === "Running") return cachedExecdUrl;
    }
    cachedSandboxId = null;
    cachedExecdUrl = null;
  }

  const id = await createSandbox(llmConfig);
  await waitForSandbox(id);
  const execdUrl = await getExecdUrl(id);
  cachedSandboxId = id;
  cachedExecdUrl = execdUrl;
  return execdUrl;
}

/** execd SSE is raw JSON lines (no "data: " prefix). */
function parseExecdSse(text: string): { stdout: string; stderr: string } {
  let stdout = "";
  let stderr = "";

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("{") === false) continue;
    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        text?: string;
        error?: { ename?: string; evalue?: string; traceback?: string[] };
      };
      if (event.type === "stdout" && event.text) stdout += event.text;
      else if (event.type === "stderr" && event.text) stderr += event.text;
      else if (event.type === "error" && event.error) {
        const { ename, evalue, traceback } = event.error;
        if (traceback?.length) {
          stderr += traceback.map((l) => l.replace(/\u001b\[[0-9;]*m/g, "")).join("\n");
        } else {
          stderr += `${ename ?? "Error"}: ${evalue ?? "unknown error"}`;
        }
      }
    } catch { /* skip malformed lines */ }
  }

  return { stdout, stderr };
}

async function execCode(execdUrl: string, code: string, language: string): Promise<{ stdout: string; stderr: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`http://${execdUrl}/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, context: { language } }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`execd code failed: ${res.status} ${await res.text()}`);
    }

    const text = await res.text();
    return parseExecdSse(text);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { stdout: "", stderr: "代码执行超时（15秒限制）" };
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function submitCode(submission: SandboxSubmission, llmConfig?: SandboxLlmConfig): Promise<SandboxResult> {
  const language = LANGUAGE_MAP[languageIdToName(submission.language_id)] ?? "python";
  const execdUrl = await ensureSandbox(llmConfig);
  const { stdout, stderr } = await execCode(execdUrl, submission.source_code, language);

  return {
    stdout: stdout || null,
    stderr: stderr || null,
    exit_code: stderr ? 1 : 0,
    time: "0",
    memory: 0,
    status: { id: 3, description: stderr ? "Runtime Error" : "Accepted" },
  };
}
