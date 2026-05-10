import { execSync } from "node:child_process";

const PORTS = [38421, 38422, 38423];

for (const port of PORTS) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
    if (pids) {
      const pidList = pids.split("\n").filter(Boolean);
      for (const pid of pidList) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {}
      }
      console.log(`[kill-ports] killed ${pidList.length} process(es) on :${port}`);
    }
  } catch {}
}
