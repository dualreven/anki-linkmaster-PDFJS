import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const isWindows = platform() === "win32";
const pnpmCommand = isWindows ? "pnpm" : "pnpm";
const pnpmArgs = ["run", "format:check", "--", "--pattern", "scripts/test-formatting-sample.js"];

const result = spawnSync(pnpmCommand, pnpmArgs, {
  stdio: "inherit",
  cwd: process.cwd(),
  shell: isWindows
});

if (result.error) {
  console.error("无法执行格式化检查:", result.error);
  process.exit(1);
}

if (typeof result.status === "number" && result.status !== 0) {
  console.error(`格式化检查失败，退出码: ${result.status}`);
  process.exit(result.status);
}

console.log("format:check 已成功执行在示例文件上。");
