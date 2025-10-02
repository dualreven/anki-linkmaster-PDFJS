/**
 * Feature-based 架构类型定义
 * @file types/features.d.ts
 * @description Feature插件化架构的核心类型定义
 */

import { EventBus } from './events';
import { WSClient } from './adapters';

/**
 * 依赖容器接口
 * @description 简单的依赖注入容器，用于管理Feature的依赖
 */
export interface IDependencyContainer {
  /**
   * 注册依赖
   * @param key - 依赖的唯一标识符
   * @param instance - 依赖实例
   */
  register<T>(key: string, instance: T): void;

  /**
   * 解析依赖
   * @param key - 依赖的唯一标识符
   * @returns 依赖实例，如果不存在则返回null
   */
  resolve<T>(key: string): T | null;

  /**
   * 检查依赖是否已注册
   * @param key - 依赖的唯一标识符
   * @returns 是否存在
   */
  has(key: string): boolean;

  /**
   * 清空所有依赖
   */
  clear(): void;

  /**
   * 获取所有已注册的依赖key
   * @returns 依赖key数组
   */
  keys(): string[];
}

/**
 * Feature接口
 * @description 所有Feature必须实现的接口
 */
export interface IFeature {
  /**
   * Feature名称（唯一标识）
   */
  readonly name: string;

  /**
   * Feature版本号（语义化版本）
   */
  readonly version: string;

  /**
   * 依赖的其他Features
   */
  readonly dependencies: readonly string[];

  /**
   * 安装Feature
   * @param container - 依赖容器，用于获取依赖和注册服务
   * @returns Promise，安装完成后resolve
   */
  install(container: IDependencyContainer): Promise<void>;

  /**
   * 卸载Feature
   * @returns Promise，卸载完成后resolve
   */
  uninstall(): Promise<void>;
}

/**
 * Feature元数据
 */
export interface FeatureMetadata {
  /** Feature名称 */
  name: string;
  /** 版本号 */
  version: string;
  /** 依赖列表 */
  dependencies: string[];
  /** 是否已安装 */
  installed: boolean;
  /** 安装时间戳 */
  installedAt?: number;
}

/**
 * Feature注册表接口
 */
export interface IFeatureRegistry {
  /**
   * 注册Feature
   * @param feature - Feature实例
   */
  register(feature: IFeature): void;

  /**
   * 获取Feature
   * @param name - Feature名称
   * @returns Feature实例或null
   */
  get(name: string): IFeature | null;

  /**
   * 检查Feature是否已注册
   * @param name - Feature名称
   * @returns 是否已注册
   */
  has(name: string): boolean;

  /**
   * 获取所有已注册的Feature
   * @returns Feature列表
   */
  getAll(): IFeature[];

  /**
   * 解析Feature依赖顺序
   * @param features - Feature列表
   * @returns 按依赖顺序排序的Feature列表
   * @throws 如果存在循环依赖或缺少依赖
   */
  resolveDependencies(features: IFeature[]): IFeature[];

  /**
   * 获取Feature元数据
   * @param name - Feature名称
   * @returns 元数据或null
   */
  getMetadata(name: string): FeatureMetadata | null;

  /**
   * 清空注册表
   */
  clear(): void;
}

/**
 * Feature���装选项
 */
export interface FeatureInstallOptions {
  /** 是否并行安装（不推荐，可能导致依赖问题） */
  parallel?: boolean;
  /** 安装超时时间（毫秒） */
  timeout?: number;
  /** 失败时是否继续安装其他Features */
  continueOnError?: boolean;
}

/**
 * Feature安装结果
 */
export interface FeatureInstallResult {
  /** 成功安装的Features */
  success: string[];
  /** 安装失败的Features */
  failed: Array<{
    name: string;
    error: Error;
  }>;
  /** 总耗时（毫秒） */
  duration: number;
}

/**
 * Bootstrap配置
 */
export interface BootstrapConfig {
  /** WebSocket URL */
  wsUrl?: string;
  /** PDF文件路径 */
  pdfPath?: string;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** Feature安装选项 */
  installOptions?: FeatureInstallOptions;
}

/**
 * 简单依赖容器类
 */
export class SimpleDependencyContainer implements IDependencyContainer {
  register<T>(key: string, instance: T): void;
  resolve<T>(key: string): T | null;
  has(key: string): boolean;
  clear(): void;
  keys(): string[];
}

/**
 * Feature注册表类
 */
export class FeatureRegistry implements IFeatureRegistry {
  register(feature: IFeature): void;
  get(name: string): IFeature | null;
  has(name: string): boolean;
  getAll(): IFeature[];
  resolveDependencies(features: IFeature[]): IFeature[];
  getMetadata(name: string): FeatureMetadata | null;
  clear(): void;
}

// ===== 核心Features的类型定义 =====

/**
 * AppCoreFeature
 * @description 应用核心Feature，提供EventBus、WebSocket等基础设施
 */
export class AppCoreFeature implements IFeature {
  readonly name: 'app-core';
  readonly version: string;
  readonly dependencies: readonly [];

  install(container: IDependencyContainer): Promise<void>;
  uninstall(): Promise<void>;
}

/**
 * PDFManagerFeature
 * @description PDF管理Feature，负���PDF加载、缓存和文档管理
 */
export class PDFManagerFeature implements IFeature {
  readonly name: 'pdf-manager';
  readonly version: string;
  readonly dependencies: readonly ['app-core'];

  install(container: IDependencyContainer): Promise<void>;
  uninstall(): Promise<void>;
}

/**
 * UIManagerFeature
 * @description UI管理Feature，负责UI渲染、控件和事件处理
 */
export class UIManagerFeature implements IFeature {
  readonly name: 'ui-manager';
  readonly version: string;
  readonly dependencies: readonly ['app-core'];

  install(container: IDependencyContainer): Promise<void>;
  uninstall(): Promise<void>;
}

// ===== Bootstrap函数类型 =====

/**
 * 启动Feature-based应用
 * @param features - Feature列表
 * @param config - Bootstrap配置
 * @returns 安装结果
 */
export function bootstrapFeatureApp(
  features: IFeature[],
  config?: BootstrapConfig
): Promise<FeatureInstallResult>;

/**
 * 启动PDF Viewer应用（Feature-based）
 * @returns Promise，启动完成后resolve
 */
export function bootstrapPDFViewerAppFeature(): Promise<void>;
