import { spawn } from "node:child_process";

await run("docker", [
  "compose",
  "exec",
  "--no-TTY",
  "game",
  "node",
  "--input-type=module",
  "--eval",
  "const response = await fetch('http://127.0.0.1:2567/operations/drain', { method: 'DELETE' }); if (!response.ok) { throw new Error(`cancel drain returned HTTP ${response.status}`); } console.log(await response.text());",
]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}
