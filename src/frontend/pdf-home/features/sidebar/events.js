// 侧边栏特性局部事件（scoped bus）
// 局部事件允许使用非三段式 / 带 @ 前缀的名字，但在调用处必须通过常量引用，避免字面量散落
export const SIDEBAR_LOCAL_EVENTS = {
  SEARCH: {
    ITEM_CLICKED: "@sidebar/search:item:clicked",
  },
  LIMIT: {
    VALUE_CHANGED: "@sidebar/limit:value:changed",
  },
  PDF: {
    ITEM_CLICKED: "pdf:item:clicked",
  },
};

export default SIDEBAR_LOCAL_EVENTS;
