import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
export function performanceLog(dir: string) {
  const file = join(dir, "performance.jsonl"),
    delay = monitorEventLoopDelay({ resolution: 50 });
  let cpu = process.cpuUsage(),
    at = performance.now(),
    warned = false;
  function log(event: string, fields: Record<string, unknown> = {}) {
    try {
      mkdirSync(dir, { recursive: true });
      if (existsSync(file) && statSync(file).size >= 1024 * 1024)
        renameSync(file, file + ".1");
      appendFileSync(
        file,
        JSON.stringify({ at: new Date().toISOString(), event, ...fields }) +
          "\n",
        { mode: 0o600 }
      );
    } catch (e) {
      if (!warned) console.warn("性能日志不可写:", (e as Error).message);
      warned = true;
    }
  }
  delay.enable();
  const timer = setInterval(() => {
    const n = performance.now(),
      c = process.cpuUsage(),
      m = process.memoryUsage();
    log("node", {
      cpu_pct: (c.user + c.system - cpu.user - cpu.system) / (n - at) / 10,
      rss_mb: m.rss / 1048576,
      heap_mb: m.heapUsed / 1048576,
      loop_resolution_ms: 50,
      loop_p95_ms: delay.percentile(95) / 1e6,
    });
    delay.reset();
    cpu = c;
    at = n;
  }, 15000);
  timer.unref();
  return {
    log,
    close() {
      clearInterval(timer);
      delay.disable();
    },
  };
}
