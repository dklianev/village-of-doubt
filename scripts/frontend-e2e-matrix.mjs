import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const browsers = ["chromium", "firefox", "webkit"];
const webRequire = createRequire(join(process.cwd(), "apps/web/package.json"));
const { createClient } = webRequire("redis");
const baseRedisUrl = process.env.FRONTEND_E2E_REDIS_URL ?? process.env.REDIS_URL;

if (!baseRedisUrl) {
  throw new Error("frontend:e2e:cross-browser requires FRONTEND_E2E_REDIS_URL or REDIS_URL.");
}

for (const [index, browser] of browsers.entries()) {
  const redisUrl = isolatedBrowserRedisUrl(baseRedisUrl, index);
  await resetRedisDatabase(redisUrl);
  await runPackageScript("frontend:e2e", {
    FRONTEND_E2E_BROWSER: browser,
    FRONTEND_E2E_SKIP_BUILD: index === 0 ? "false" : "true",
    REDIS_URL: redisUrl,
  });
}

console.log(`Frontend browser matrix passed: ${browsers.join(", ")}.`);

function runPackageScript(script, env) {
  const invocation = packageManagerInvocation();

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, [...invocation.args, script], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: false,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(
        `${script} failed for ${env.FRONTEND_E2E_BROWSER} with ${signal ? `signal ${signal}` : `exit code ${code}`}.`,
      ));
    });
  });
}

function packageManagerInvocation() {
  const cli = process.env.npm_execpath;
  return cli
    ? { command: process.execPath, args: [cli] }
    : { command: "pnpm", args: [] };
}

function isolatedBrowserRedisUrl(value, browserIndex) {
  const url = new URL(value);
  if (
    !["redis:", "rediss:"].includes(url.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("Cross-browser E2E refuses non-local Redis instances.");
  }
  url.pathname = `/${12 + browserIndex}`;
  return url.toString();
}

async function resetRedisDatabase(url) {
  const client = createClient({ url });
  try {
    await client.connect();
    await client.flushDb();
  } finally {
    if (client.isOpen) {
      await client.quit().catch(() => client.destroy());
    }
  }
}
