/**
 * PDF 目的地解析工具
 * @module pdf-dest-utils
 * @description 将 PDF.js 的 destination（字符串命名目的地 / 数组 / 数字页索引）统一解析为 1-based 页码，并尽量保留位置信息
 */

import { getLogger } from "../../common/utils/logger.js";

const logger = getLogger("PdfDestUtils");

/**
 * 解析 PDF.js destination 为标准对象
 * @param {import("pdfjs-dist").PDFDocumentProxy} pdfDocument - PDFDocument 实例
 * @param {string|number|Array|Object|null} dest - PDF.js 目的地（字符串命名目的地 / `[pageRef, ...]` / 数字页索引等）
 * @returns {Promise<{pageNumber:number, x:number|null, y:number|null, zoom:number|null}>}
 * - pageNumber: 1-based 页码
 * - x/y/zoom: 若可解析则返回具体值，否则为 null
 */
export async function resolvePdfDest(pdfDocument, dest) {
  if (!dest) {
    throw new Error("dest is required");
  }
  if (!pdfDocument) {
    throw new Error("pdfDocument is required");
  }

  // 1) 若为字符串：命名目的地，需要先解析成数组
  let array = dest;
  if (typeof dest === "string") {
    try {
      array = await pdfDocument.getDestination(dest);
    } catch (e) {
      logger.error("Failed to resolve named destination:", e);
      throw new Error(`Failed to resolve named destination: ${dest}`);
    }
  }

  // 2) 若为数字：视为 0-based 页索引，统一 +1 → 页码
  if (typeof array === "number") {
    const pageNumber = array + 1;
    return { pageNumber, x: null, y: null, zoom: null };
  }

  // 3) 若为数组：[pageRef, destType, ...params]
  if (Array.isArray(array) && array.length > 0) {
    const [pageRef, _destType, left, top, zoom] = array;

    // pageRef 可能是 0-based 页索引（number）或引用对象（{num,gen}）
    if (typeof pageRef === "number") {
      return {
        pageNumber: pageRef + 1,
        x: (typeof left === "number") ? left : null,
        y: (typeof top === "number") ? top : null,
        zoom: (typeof zoom === "number") ? zoom : null,
      };
    }
    if (pageRef && typeof pageRef === "object") {
      try {
        const pageIndex = await pdfDocument.getPageIndex(pageRef);
        return {
          pageNumber: pageIndex + 1,
          x: (typeof left === "number") ? left : null,
          y: (typeof top === "number") ? top : null,
          zoom: (typeof zoom === "number") ? zoom : null,
        };
      } catch (e) {
        logger.error("Failed to resolve pageRef to index:", e);
        throw new Error("Failed to resolve pageRef to index");
      }
    }

    // 未知格式，降级仅返回页码不可得
    throw new Error("Unknown destination pageRef format");
  }

  // 4) 其他非常规情况（例如直接是引用对象）尝试按引用对象处理
  if (typeof array === "object") {
    try {
      const pageIndex = await pdfDocument.getPageIndex(array);
      return { pageNumber: pageIndex + 1, x: null, y: null, zoom: null };
    } catch (e) {
      logger.error("Failed to resolve object dest to page index:", e);
      throw new Error("Invalid destination object");
    }
  }

  throw new Error("Invalid destination format");
}

export default { resolvePdfDest };

