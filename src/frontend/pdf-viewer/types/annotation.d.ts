/**
 * Annotation 类型定义
 * @file types/annotation.d.ts
 * @description PDF标注功能相关的类型定义
 */

/**
 * 标注类型
 */
export type AnnotationType = 'screenshot' | 'text-highlight' | 'comment';

/**
 * 高亮颜色
 */
export type HighlightColor = '#ffff00' | '#90ee90' | '#87ceeb' | '#ffb6c1';

/**
 * 矩形区域
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 位置坐标
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 文本范围
 */
export interface TextRange {
  start: number;
  end: number;
}

/**
 * 截图标注数据
 */
export interface ScreenshotAnnotationData {
  /** 截图区域 */
  rect: Rect;
  /** base64图片数据 */
  imageData: string;
  /** 描述文字 */
  description?: string;
}

/**
 * 选字高亮标注数据
 */
export interface TextHighlightAnnotationData {
  /** 选中的文本内容 */
  selectedText: string;
  /** 文本范围数组 */
  textRanges: TextRange[];
  /** 高亮颜色 */
  highlightColor: string;
  /** 笔记 */
  note?: string;
}

/**
 * 批注标注数据
 */
export interface CommentAnnotationData {
  /** 批注位置 */
  position: Position;
  /** 批注内容 */
  content: string;
}

/**
 * 标注类型特定数据联合类型
 */
export type AnnotationData =
  | ScreenshotAnnotationData
  | TextHighlightAnnotationData
  | CommentAnnotationData;

/**
 * 评论接口
 */
export interface IComment {
  /** 评论唯一ID */
  id: string;
  /** 所属标注ID */
  annotationId: string;
  /** 评论内容 */
  content: string;
  /** 创建时间 ISO 8601格式 */
  createdAt: string;
}

/**
 * 标注接口
 */
export interface IAnnotation {
  /** 标注唯一ID */
  id: string;
  /** 标注类型 */
  type: AnnotationType;
  /** 页码（从1开始） */
  pageNumber: number;
  /** 类型特定的数据 */
  data: AnnotationData;
  /** 评论列表 */
  comments: IComment[];
  /** 创建时间 ISO 8601格式 */
  createdAt: string;
  /** 更新时间 ISO 8601格式 */
  updatedAt: string;
}

/**
 * 评论类
 */
export class Comment implements IComment {
  id: string;
  annotationId: string;
  content: string;
  createdAt: string;

  constructor(data: Partial<IComment> & Pick<IComment, 'annotationId' | 'content'>);

  toJSON(): IComment;
  static fromJSON(json: IComment): Comment;
  updateContent(newContent: string): void;
  getPreview(maxLength?: number): string;
  getFormattedDate(locale?: string): string;
}

/**
 * 标注类
 */
export class Annotation implements IAnnotation {
  id: string;
  type: AnnotationType;
  pageNumber: number;
  data: AnnotationData;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;

  constructor(data: Partial<IAnnotation> & Pick<IAnnotation, 'type' | 'pageNumber' | 'data'>);

  toJSON(): IAnnotation;
  static fromJSON(json: IAnnotation): Annotation;
  update(changes: Partial<{ data: AnnotationData }>): void;
  addComment(comment: Comment | Partial<IComment>): Comment;
  removeComment(commentId: string): boolean;
  getCommentCount(): number;
  getDescription(): string;
  getTypeIcon(): string;
  getFormattedDate(locale?: string): string;

  // 静态工厂方法
  static createScreenshot(
    pageNumber: number,
    rect: Rect,
    imageData: string,
    description?: string
  ): Annotation;

  static createTextHighlight(
    pageNumber: number,
    selectedText: string,
    textRanges: TextRange[],
    highlightColor: string,
    note?: string
  ): Annotation;

  static createComment(
    pageNumber: number,
    position: Position,
    content: string
  ): Annotation;
}

/**
 * 标注管理器接口
 */
export interface IAnnotationManager {
  /** 初始化并加载标注 */
  initialize(pdfPath: string): Promise<void>;

  /** 创建标注 */
  createAnnotation(annotationData: Partial<IAnnotation> & Pick<IAnnotation, 'type' | 'pageNumber' | 'data'>): Promise<Annotation>;

  /** 更新标注 */
  updateAnnotation(id: string, changes: Partial<Pick<IAnnotation, 'data'>>): Promise<Annotation>;

  /** 删除标注 */
  deleteAnnotation(id: string): Promise<boolean>;

  /** 获取标注 */
  getAnnotation(id: string): Annotation | null;

  /** 获取指定页的标注 */
  getAnnotationsByPage(pageNumber: number): Annotation[];

  /** 获取所有标注 */
  getAllAnnotations(): Annotation[];

  /** 添加评论 */
  addComment(annotationId: string, content: string): Promise<Comment>;

  /** 删除评论 */
  deleteComment(commentId: string): Promise<boolean>;

  /** 保存标注到后端 */
  saveAnnotations(): Promise<void>;

  /** 从后端加载标注 */
  loadAnnotations(pdfPath: string): Promise<Annotation[]>;
}

/**
 * 标注存储接口
 */
export interface IAnnotationStorage {
  /** 保存标注到后端 */
  save(pdfPath: string, annotations: Annotation[]): Promise<void>;

  /** 从后端加载标注 */
  load(pdfPath: string): Promise<Annotation[]>;

  /** 删除标注 */
  delete(pdfPath: string, annotationId: string): Promise<void>;
}

/**
 * 标注渲染器接口
 */
export interface IAnnotationRenderer {
  /** 渲染单个标注 */
  render(annotation: Annotation): void;

  /** 渲染所有标注 */
  renderAll(annotations: Annotation[]): void;

  /** 移除标注渲染 */
  remove(id: string): void;

  /** 高亮标注（闪烁效果） */
  highlight(id: string): void;
}

/**
 * 截图捕获器接口
 */
export interface IScreenshotCapturer {
  /**
   * 捕获PDF指定区域的截图
   * @param pageNumber - 页码
   * @param rect - 区域
   * @returns base64图片数据
   */
  capture(pageNumber: number, rect: Rect): Promise<string>;
}

/**
 * 标注工具接口
 */
export interface IAnnotationTool {
  /** 激活工具 */
  activate(): void;

  /** 停用工具 */
  deactivate(): void;

  /** 工具是否激活 */
  isActive(): boolean;
}

/**
 * 标注侧边栏UI接口
 */
export interface IAnnotationSidebarUI {
  /** 创建UI */
  createUI(): HTMLElement;

  /** 显示侧边栏 */
  show(): void;

  /** 隐藏侧边栏 */
  hide(): void;

  /** 切换显示 */
  toggle(): void;

  /** 渲染标注列表 */
  render(annotations: Annotation[]): void;

  /** 添加标注卡片 */
  addAnnotationCard(annotation: Annotation): void;

  /** 更新标注卡片 */
  updateAnnotationCard(annotation: Annotation): void;

  /** 移除标注卡片 */
  removeAnnotationCard(id: string): void;
}

/**
 * 标注Feature配置
 */
export interface AnnotationFeatureConfig {
  /** 是否启用自动保存 */
  autoSave?: boolean;
  /** 自动保存延迟（毫秒） */
  autoSaveDelay?: number;
  /** 默认高亮颜色 */
  defaultHighlightColor?: HighlightColor;
  /** 是否启用虚拟滚动 */
  virtualScroll?: boolean;
}
