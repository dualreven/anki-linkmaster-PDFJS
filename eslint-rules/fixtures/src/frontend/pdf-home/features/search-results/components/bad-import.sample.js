// Fixture: 跨特性内部导入（应被 custom/no-cross-feature-internals 命中）
import { ResultItemRenderer } from "../../search-result-item/components/result-item-renderer.js";
export default function demo(logger) { return new ResultItemRenderer(logger); }

