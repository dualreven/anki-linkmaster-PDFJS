#!/usr/bin/env node
/**
 * WS 契约差异检查脚本
 * - 对比前端 WEBSOCKET_MESSAGE_TYPES 与 后端 MessageType(Enum) 的字符串集合
 * - 任一方向缺失即退出码 1，用于 CI 门禁
 *
 * 用法：
 *   node scripts/ci/ws-contract-diff.mjs
 *
 * 实现说明：
 * - 优先通过 ESM 动态导入读取前端常量；若失败，回退到正则提取
 * - 后端 Python Enum 通过正则解析
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const FRONT_JS = resolve("src/frontend/common/event/event-constants.js");
const BACK_PY = resolve("src/backend/msgCenter_server/core/message_types.py");

function isTriad(s) {
  if (typeof s !== "string") {
    return false;
  }
  const parts = s.split(":");
  if (parts.length !== 3) {
    return false;
  }
  const status = parts[2];
  return status === "requested"
    || status === "completed"
    || status === "failed"
    || status === "request"
    || status === "complete";
}

async function getFrontendTypes() {
  // 尝试动态导入（ESM）
  try {
    const mod = await import(pathToFileURL(FRONT_JS).href);
    const types = new Set();
    const src = mod?.WEBSOCKET_MESSAGE_TYPES || mod?.default?.WEBSOCKET_MESSAGE_TYPES;
    if (src && typeof src === "object") {
      Object.values(src).forEach((v) => { if (typeof v === "string") { types.add(v); } });
    }
    if (types.size > 0) { return types; }
  } catch (_e) {
    // ignore and fallback
  }
  // 回退：正则解析
  const code = await readFile(FRONT_JS, { encoding: "utf8" });
  const objMatch = code.match(/export\s+const\s+WEBSOCKET_MESSAGE_TYPES\s*=\s*\{([\s\S]*?)\};/u);
  const out = new Set();
  if (objMatch) {
    const body = objMatch[1];
    const re = /:\s*"([^"]+)"/gu;
    let m;
    while ((m = re.exec(body))) {
      const val = m[1];
      if (typeof val === "string") { out.add(val); }
    }
  }
  return out;
}

async function getBackendTypes() {
  const py = await readFile(BACK_PY, { encoding: "utf8" });
  const out = new Set();
  // 匹配：FOO_BAR = "module:action:status"
  const re = /=\s*"([^"]+)"/gu;
  let m;
  while ((m = re.exec(py))) {
    const val = m[1];
    if (typeof val === "string") { out.add(val); }
  }
  return out;
}

function diffSets(a, b) {
  const onlyA = [];
  const onlyB = [];
  a.forEach((v) => { if (!b.has(v)) { onlyA.push(v); } });
  b.forEach((v) => { if (!a.has(v)) { onlyB.push(v); } });
  return { onlyA, onlyB };
}

async function main() {
  const fe = await getFrontendTypes();
  const be = await getBackendTypes();

  // 仅关注三段式
  const fe3 = new Set([...fe].filter(isTriad));
  const be3 = new Set([...be].filter(isTriad));

  const { onlyA: onlyFrontend, onlyB: onlyBackend } = diffSets(fe3, be3);

  if (onlyFrontend.length === 0 && onlyBackend.length === 0) {
    console.log("WS 契约检查通过：前后端三段式消息类型一致（共 %d 项）", fe3.size);
    process.exit(0);
  }

  console.error("WS 契约不一致：");
  if (onlyFrontend.length) {
    console.error("- 仅前端存在（后端缺失）：");
    onlyFrontend.sort().forEach((s) => console.error("  • %s", s));
  }
  if (onlyBackend.length) {
    console.error("- 仅后端存在（前端缺失）：");
    onlyBackend.sort().forEach((s) => console.error("  • %s", s));
  }
  process.exit(1);
}

main().catch((e) => {
  console.error("契约检查发生错误：", e?.stack || e);
  process.exit(2);
});
