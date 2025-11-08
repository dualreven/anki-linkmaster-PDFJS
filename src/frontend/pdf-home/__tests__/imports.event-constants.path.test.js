/**
 * 防回归测试：校验 pdf-home 子域内对 event-constants.js 的相对路径层级是否正确
 * 规则：
 *  - 计算每个文件相对 `src/frontend` 的目录深度 d
 *  - 期望导入前缀为 `../` 重复 d 次，再拼接 `common/event/event-constants.js`
 *
 * 注意：仅检查同一常量源（不改变业务）
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(process.cwd());
const FRONTEND_ROOT = path.join(REPO_ROOT, "src", "frontend");
const PDF_HOME_ROOT = path.join(FRONTEND_ROOT, "pdf-home");
const TARGET_SUFFIX = path.join("common", "event", "event-constants.js");

function walk(dir) {
  /** @type {string[]} */
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const entry of fs.readdirSync(d, { withFileTypes: true, encoding: "utf8" })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        // 忽略测试输出/构建产物
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "vendor") continue;
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".js")) {
        files.push(full);
      }
    }
  }
  return files;
}

function expectedPrefixFor(fileDir) {
  const relToFrontend = path.relative(FRONTEND_ROOT, fileDir);
  const depth = relToFrontend === "" ? 0 : relToFrontend.split(path.sep).length;
  return "../".repeat(depth);
}

describe("event-constants import path depth", () => {
  const files = walk(PDF_HOME_ROOT);

  test("all imports to event-constants.js use correct depth", () => {
    const bad = [];
    const importRe = /from\s+['"](\.\.\/)+common\/event\/event-constants\.js['"]|import\(\s*['"](\.\.\/)+common\/event\/event-constants\.js['"]\s*\)/g;
    for (const file of files) {
      const content = fs.readFileSync(file, { encoding: "utf8" });
      const dir = path.dirname(file);
      const expectedPrefix = expectedPrefixFor(dir);
      const expected = expectedPrefix + TARGET_SUFFIX.replace(/\\/g, "/");

      let m;
      while ((m = importRe.exec(content)) !== null) {
        // 取出匹配到的完整相对路径（第二个捕获组可能为 undefined）
        const slice = content.slice(m.index, m.index + m[0].length);
        const captured = slice.match(/['"](\.\.\/)+(?:common\/event\/event-constants\.js)['"]/);
        const rel = captured ? captured[0].slice(1, -1) : null; // 去掉引号
        if (rel && rel !== expected) {
          bad.push({ file: path.relative(REPO_ROOT, file), rel, expected });
        }
      }
    }
    if (bad.length) {
      const msg = bad
        .map(b => `- ${b.file}: found "${b.rel}" expected "${b.expected}"`)
        .join("\n");
      throw new Error("Invalid event-constants import path depth:\n" + msg + "\n");
    }
  });
});

