// Fixture: 经公共入口导入（不应被命中）
import { ResultItemRenderer } from "../../search-result-item/public.js";
export default function demo(logger) { return new ResultItemRenderer(logger); }

