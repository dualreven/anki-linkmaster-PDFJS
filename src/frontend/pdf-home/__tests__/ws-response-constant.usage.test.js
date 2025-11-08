/**
 * 防回归测试：禁止在 pdf-home 子域中使用 WEBSOCKET_EVENTS.MESSAGE.RESPONSE
 * 正确常量应为：WEBSOCKET_MESSAGE_EVENTS.RESPONSE
 *
 * 说明：
 * - 本测试读取源码文本进行静态检查，避免运行时漏检；
 * - 仅限制 pdf-home 子域，其他子域如需使用同样规则，可复制此用例。
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(process.cwd());
const TARGET_ROOT = path.join(REPO_ROOT, "src", "frontend", "pdf-home");
const BAD_PATTERN = "WEBSOCKET_EVENTS.MESSAGE.RESPONSE";

function stripComments(code) {
  // 简易移除注释（不处理字符串内的 // 或 /* */ 边缘情形，但足够用于本仓库的规则扫描）
  return code
    .replace(/\/\*[^]*?\*\//g, "")   // 块注释
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // 行注释（忽略 http:// 等）
}

function walk(dir) {
  /** @type {string[]} */
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const entry of fs.readdirSync(d, { withFileTypes: true, encoding: "utf8" })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "vendor") {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".js")) {
        files.push(full);
      }
    }
  }
  return files;
}

describe("WS RESPONSE constant usage", () => {
  it("must not use WEBSOCKET_EVENTS.MESSAGE.RESPONSE in pdf-home", () => {
    const badHits = [];
    for (const f of walk(TARGET_ROOT)) {
      // 排除本测试文件自身
      if (f.endsWith(path.join("pdf-home", "__tests__", "ws-response-constant.usage.test.js"))) {
        continue;
      }
      const content = stripComments(fs.readFileSync(f, { encoding: "utf8" }));
      if (content.includes(BAD_PATTERN)) {
        badHits.push(path.relative(REPO_ROOT, f));
      }
    }
    if (badHits.length) {
      throw new Error("Found forbidden constant usage (use WEBSOCKET_MESSAGE_EVENTS.RESPONSE instead):\n" + badHits.map(p => "- " + p).join("\n"));
    }
  });
});
