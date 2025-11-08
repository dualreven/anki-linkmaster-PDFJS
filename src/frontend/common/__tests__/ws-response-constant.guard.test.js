/**
 * UTF-8
 * 防回归：全仓禁止误用 WEBSOCKET_EVENTS.MESSAGE.RESPONSE（正确常量为 WEBSOCKET_MESSAGE_EVENTS.RESPONSE）
 * 以及限制 WEBSOCKET_EVENTS.MESSAGE.* 只允许 SEND / RECEIVED / SEND_FAILED
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..'); // -> src/frontend/common/__tests__ -> repo root
const SRC_DIR = path.join(REPO_ROOT, 'src');

function* walk(dir) {
  const items = fs.readdirSync(dir, { encoding: 'utf8', withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      // 忽略不需要扫描的目录
      if (/(^|\\|\/)(node_modules|dist|public|data|__pycache__|\.venv)(\\|\/|$)/.test(full)) continue;
      yield* walk(full);
    } else {
      // 仅扫描 .js/.mjs/.cjs 源码；跳过 __tests__ 与 __smoke__ 文件
      if (!/\.(m?c?js)$/.test(it.name)) continue;
      if (/(__tests__|__smoke__)/.test(full)) continue;
      yield full;
    }
  }
}

function readUtf8(file) {
  return fs.readFileSync(file, { encoding: 'utf8' });
}

describe('WS 常量使用防回归（全仓）', () => {
  const files = Array.from(walk(SRC_DIR));

  test('禁止使用 WEBSOCKET_EVENTS.MESSAGE.RESPONSE（忽略注释命中）', () => {
    const badHits = [];
    for (const f of files) {
      const txt = readUtf8(f);
      // 简易注释过滤：按行扫描，跳过 // 与 /* ... */ 内的内容
      let inBlock = false;
      const lines = txt.split(/\r?\n/);
      for (const line of lines) {
        let l = line;
        // 处理块注释开始/结束
        if (inBlock) {
          if (l.includes('*/')) {
            inBlock = false;
          }
          continue;
        }
        const bcStart = l.indexOf('/*');
        const slStart = l.indexOf('//');
        const patIdx = l.indexOf('WEBSOCKET_EVENTS.MESSAGE.RESPONSE');
        if (bcStart >= 0 && (patIdx < 0 || bcStart < patIdx)) {
          inBlock = true;
        }
        if (patIdx >= 0) {
          // 若 // 在常量之前，则忽略（注释命中）
          if (slStart >= 0 && slStart < patIdx) {
            continue;
          }
          // 若处于块注释内，已 continue；此处可视为有效命中
          badHits.push(f);
          break;
        }
      }
    }
    if (badHits.length > 0) {
      throw new Error(
        'Found forbidden constant usage: WEBSOCKET_EVENTS.MESSAGE.RESPONSE\n' +
        badHits.map(p => '- ' + path.relative(REPO_ROOT, p)).join('\n')
      );
    }
  });

  test('WEBSOCKET_EVENTS.MESSAGE.* 仅允许 SEND/RECEIVED/SEND_FAILED（忽略注释命中）', () => {
    const badRefs = [];
    const allowed = new Set(['SEND', 'RECEIVED', 'SEND_FAILED']);
    const re = /WEBSOCKET_EVENTS\.MESSAGE\.([A-Z_]+)/g;
    for (const f of files) {
      const txt = readUtf8(f);
      const lines = txt.split(/\r?\n/);
      let inBlock = false;
      for (const line of lines) {
        let l = line;
        if (inBlock) {
          if (l.includes('*/')) inBlock = false;
          continue;
        }
        const bc = l.indexOf('/*');
        const sl = l.indexOf('//');
        let m;
        while ((m = re.exec(l)) !== null) {
          const k = m[1];
          const idx = m.index;
          if (bc >= 0 && bc < idx) { inBlock = true; break; }
          if (sl >= 0 && sl < idx) { continue; }
          if (!allowed.has(k)) {
            badRefs.push(`${path.relative(REPO_ROOT, f)}:${k}`);
          }
        }
      }
    }
    if (badRefs.length > 0) {
      throw new Error(
        'Found disallowed WEBSOCKET_EVENTS.MESSAGE.* members (only SEND/RECEIVED/SEND_FAILED are allowed):\n' +
        badRefs.map(s => '- ' + s).join('\n')
      );
    }
  });
});
