import { test, expect } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:48422";

test.describe.configure({ mode: "serial" });

test.describe("Sandbox IDE — API Integration", () => {
  test.describe.configure({ timeout: 60_000 });

  test("sandbox file CRUD works end-to-end", async ({ request }) => {
    // 1. Upload (with retry — sandbox may need warm-up time)
    let uploadRes;
    for (let attempt = 0; attempt < 3; attempt++) {
      uploadRes = await request.post(`${API}/api/sandbox/files/upload`, {
        multipart: {
          metadata: {
            name: "metadata",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify({ path: "/workspace/e2e-test.py" })),
          },
          file: {
            name: "e2e-test.py",
            mimeType: "text/plain",
            buffer: Buffer.from('print("e2e sandbox test")'),
          },
        },
      });
      if (uploadRes.ok()) break;
      await new Promise((r) => setTimeout(r, 5000));
    }
    expect(uploadRes!.ok()).toBeTruthy();
    expect(await uploadRes!.json()).toEqual({ ok: true });

    // 2. Search
    const searchRes = await request.get(
      `${API}/api/sandbox/files/search?path=/workspace`,
    );
    expect(searchRes.ok()).toBeTruthy();
    const files = await searchRes.json();
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/workspace/e2e-test.py" }),
      ]),
    );

    // 3. Read content
    const contentRes = await request.get(
      `${API}/api/sandbox/files/content?path=${encodeURIComponent("/workspace/e2e-test.py")}`,
    );
    expect(contentRes.ok()).toBeTruthy();
    expect(await contentRes.json()).toEqual({
      content: 'print("e2e sandbox test")',
      path: "/workspace/e2e-test.py",
    });

    // 4. Delete
    const deleteRes = await request.delete(
      `${API}/api/sandbox/files?path=${encodeURIComponent("/workspace/e2e-test.py")}`,
    );
    expect(deleteRes.ok()).toBeTruthy();
    expect(await deleteRes.json()).toEqual({ ok: true });

    // 5. Verify deleted
    const afterRes = await request.get(
      `${API}/api/sandbox/files/search?path=/workspace`,
    );
    const afterFiles = await afterRes.json();
    expect(afterFiles).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/workspace/e2e-test.py" }),
      ]),
    );
  });

  test("PTY session creation works", async ({ request }) => {
    const res = await request.post(`${API}/api/sandbox/pty`, {
      data: { cwd: "/workspace" },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty("session_id");
    expect(typeof data.session_id).toBe("string");
    expect(data.session_id.length).toBeGreaterThan(0);
  });

  test("code execution works", async ({ request }) => {
    const res = await request.post(`${API}/api/sandbox/execute`, {
      data: {
        source_code: 'print("hello from e2e")',
        language_id: 71,
      },
    });
    expect(res.ok()).toBeTruthy();
    const result = await res.json();
    expect(result.stdout).toBe("hello from e2e\n");
    expect(result.exitCode).toBe(0);
    expect(result.status).toBe("Accepted");
  });
});
