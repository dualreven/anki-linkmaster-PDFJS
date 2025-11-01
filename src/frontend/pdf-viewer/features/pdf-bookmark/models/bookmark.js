/**
 * @file Bookmark 数据模型
 * @module features/pdf-bookmark/models/bookmark
 * @description 定义书签数据结构和工厂方法
 */

/**
 * 生成唯一ID（outline 节点ID 规范化）
 * 规则：outlineItem-<8位Base64URL>
 * - 使用 6 字节随机源，经 Base64 编码为 8 字符
 * - 使用 URL-safe 字符集：+ → -，/ → _，去除 =
 * @returns {string} 例如：outlineItem-1aB_CdEf
 * @private
 */
function generateId() {
  try {
    const buf = new Uint8Array(6);
    // 浏览器环境优先使用加密随机
    const cryptoObj = (typeof globalThis !== "undefined" && (globalThis.crypto || globalThis.msCrypto)) || null;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      cryptoObj.getRandomValues(buf);
    } else {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = Math.floor(Math.random() * 256);
      }
    }
    // 将字节数组转换为字符串再 Base64 编码
    let b64;
    if (typeof btoa === "function") {
      b64 = btoa(String.fromCharCode(...buf));
    } else {
      // 非浏览器环境兜底（很少用于前端代码路径）
      b64 = Buffer.from(buf).toString("base64");
    }
    // URL-safe 并去掉填充 =，理论长度即 8
    const id8 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "").slice(0, 8);
    return `outlineItem-${id8}`;
  } catch (e) {
    // 兜底：退回旧逻辑但前缀保持为 outlineItem-
    return `outlineItem-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Bookmark 数据模型（破坏性更新版）
 * 统一为“页码 + 位置百分比”，不再区分类型与 region。
 * - pageAt: 1-based 页码
 * - position: 0~100 的整数百分比，或 null（表示未指定）
 */
export class Bookmark {
  constructor(data) {
    const now = new Date().toISOString();
    this.id = data.id || generateId();
    this.name = data.name || "未命名大纲";
    // 严格模式：不再默认 1；无效即置为 null，由上层决定是否跳转或报错
    // 同时允许将字符串数字如 "5" 规范化为 5
    const pageAtNum = (() => {
      if (typeof data.pageAt === "number") {return data.pageAt;}
      if (typeof data.pageAt === "string" && /^[0-9]+$/.test(data.pageAt)) {return parseInt(data.pageAt, 10);}
      return NaN;
    })();
    this.pageAt = (Number.isInteger(pageAtNum) && pageAtNum > 0) ? pageAtNum : null;
    this.position = (typeof data.position === "number" && isFinite(data.position))
      ? Math.max(0, Math.min(100, Math.round(data.position)))
      : null;
    this.children = Array.isArray(data.children) ? data.children : [];
    this.parentId = data.parentId || null;
    this.order = typeof data.order === "number" ? data.order : 0;
    this.createdAt = data.createdAt || now;
    this.updatedAt = data.updatedAt || now;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      pageAt: this.pageAt,
      position: this.position,
      children: this.children.map(child => child instanceof Bookmark ? child.toJSON() : child),
      parentId: this.parentId,
      order: this.order,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(data) {
    // 不再兼容旧字段；仅接受标准字段 pageAt/position
    const b = new Bookmark({
      id: data.id,
      name: data.name,
      pageAt: data.pageAt,
      position: data.position,
      parentId: data.parentId,
      order: data.order,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      children: data.children
    });
    if (Array.isArray(data.children)) {
      b.children = data.children.map(child => Bookmark.fromJSON(child));
    }
    return b;
  }

  static create(pageAt, position = null, name) {
    return new Bookmark({
      name: name || `第 ${pageAt} 页${typeof position === "number" ? `（${position}%）` : ""}`,
      pageAt,
      position
    });
  }

  update(updates) {
    if (typeof updates.name === "string") {this.name = updates.name;}
    if (Number.isInteger(updates.pageAt) && updates.pageAt > 0) {this.pageAt = updates.pageAt;}
    if (updates.position === null || typeof updates.position === "number") {
      this.position = (updates.position === null) ? null : Math.max(0, Math.min(100, Math.round(updates.position)));
    }
    if (typeof updates.order === "number") {this.order = updates.order;}
    if (typeof updates.parentId === "string" || updates.parentId === null) {this.parentId = updates.parentId;}
    if (Array.isArray(updates.children)) {this.children = updates.children;}
    this.updatedAt = new Date().toISOString();
    return this;
  }

  addChild(childBookmark) {
    childBookmark.parentId = this.id;
    childBookmark.order = this.children.length;
    this.children.push(childBookmark);
    this.updatedAt = new Date().toISOString();
    return this;
  }

  removeChild(childId) {
    const index = this.children.findIndex(child => child.id === childId);
    if (index === -1) {return null;}
    const removed = this.children.splice(index, 1)[0];
    this.children.forEach((child, i) => { child.order = i; });
    this.updatedAt = new Date().toISOString();
    return removed;
  }

  validate() {
    const errors = [];
    if (!this.name || this.name.trim() === "") {
      errors.push("大纲名称不能为空");
    }
    if (!Number.isInteger(this.pageAt) || this.pageAt < 1) {
      errors.push("pageAt 必须是大于0的整数");
    }
    if (!(this.position === null || (typeof this.position === "number" && this.position >= 0 && this.position <= 100))) {
      errors.push("position 必须是 0~100 的数字，或 null");
    }
    return { valid: errors.length === 0, errors };
  }
}

export default Bookmark;
