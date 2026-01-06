import { Annotation } from "../../../../../common/models/annotation.js";

export function createCommentAnnotation({ pageNumber, xPercent, yPercent, content }) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error("[CommentTool] createCommentAnnotation: pageNumber must be a positive integer");
  }
  if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) {
    throw new Error("[CommentTool] createCommentAnnotation: xPercent/yPercent must be numbers");
  }
  if (xPercent < 0 || xPercent > 100 || yPercent < 0 || yPercent > 100) {
    throw new Error("[CommentTool] createCommentAnnotation: xPercent/yPercent must be within [0,100]");
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("[CommentTool] createCommentAnnotation: content must be a non-empty string");
  }

  // 1) 渲染/缩放使用百分比坐标 positionPercent
  const annotation = Annotation.createComment(pageNumber, { xPercent, yPercent }, content);

  // 2) 后端契约要求 position 必填；存储为百分比（0..100），以便跨缩放稳定
  annotation.data.position = { x: xPercent, y: yPercent };

  return annotation;
}

