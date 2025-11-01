/**
 * filter/public.js
 * 统一公共入口：对外暴露条件类型与工厂，禁止跨特性引用内部 services/*。
 */
export { IFilterCondition, FieldCondition, FuzzyCondition, CompositeCondition } from "./services/filter-conditions.js";
export { FilterConditionFactory } from "./services/filter-condition-factory.js";

