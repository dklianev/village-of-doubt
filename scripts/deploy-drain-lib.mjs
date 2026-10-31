import { execFile } from "node:child_process";

export function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new Error(`${name} must be a positive timer-safe integer.`);
  }
  return value;
}

export function runBounded(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: process.cwd(), timeout: timeoutMs, killSignal: "SIGKILL",
      maxBuffer: 64 * 1024, encoding: "utf8", windowsHide: true,
    }, (error, stdout) => {
      if (error) reject(new Error("Bounded drain operation failed or timed out."));
      else resolve(stdout);
    });
  });
}

export async function drainRequest(method, timeoutMs, run = runBounded) {
  const url = method === "GET"
    ? "http://127.0.0.1:2567/operations/stats"
    : "http://127.0.0.1:2567/operations/drain";
  const output = await run("docker", [
    "compose", "exec", "--no-TTY", "game", "node", "--input-type=module", "--eval",
    `const response = await fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, signal: AbortSignal.timeout(${timeoutMs}) }); if (!response.ok) throw new Error('drain HTTP failure'); console.log(await response.text());`,
  ], timeoutMs);
  return method === "GET" ? JSON.parse(output.trim()) : undefined;
}
