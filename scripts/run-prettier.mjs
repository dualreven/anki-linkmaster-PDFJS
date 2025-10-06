import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const isWindows = platform() === "win32";
const defaultTargets = [
  "src",
  "scripts",
  "babel.config.js",
  "eslint.config.js",
  "vite.config.js",
  "package.json"
];

const cliArgs = process.argv.slice(2);
let mode = "--write";
const patterns = [];

for (let index = 0; index < cliArgs.length; index += 1) {
  const arg = cliArgs[index];
  if (arg === "--") {
    continue;
  }
  if (arg === "--check") {
    mode = "--check";
  } else if (arg === "--write") {
    mode = "--write";
  } else if (arg === "--pattern") {
    const nextValue = cliArgs[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      console.error("--pattern 需要一个后续参数");
      process.exit(1);
    }
    patterns.push(nextValue);
    index += 1;
  } else if (arg.startsWith("--pattern=")) {
    const value = arg.split("=")[1];
    if (value) {
      patterns.push(value);
    }
  }
}

const targets = patterns.length > 0 ? patterns : defaultTargets;

const pnpmArgs = [
  "exec",
  "prettier",
  "--config",
  ".prettierrc.json",
  mode,
  ...targets
];

const result = spawnSync(isWindows ? "pnpm" : "pnpm", pnpmArgs, {
  stdio: "inherit",
  cwd: process.cwd(),
  shell: isWindows
});

if (result.error) {
  console.error("执行 Prettier 失败:", result.error);
  process.exit(1);
}

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}

