/**
 * Annotation - 标注数据模型（pdf-annotation feature 复出口）
 * @description
 * 本模块禁止维护第二份实现；唯一真源位于 `src/frontend/common/models/annotation.js`。
 */

export {
  Annotation,
  AnnotationType,
  HighlightColor,
  generateAnnotationId,
  generateBase64Url16
} from "../../../../common/models/annotation.js";

export { default } from "../../../../common/models/annotation.js";
