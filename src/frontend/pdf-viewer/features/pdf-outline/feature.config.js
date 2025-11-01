export const PDFOutlineFeatureConfig = {
  name: "pdf-outline",
  version: "1.0.0",
  dependencies: ["pdf-manager", "core-navigation"],
  description: "大纲（Outline）功能（复用书签存储/契约）",
  optional: true,
  events: {
    OUTLINE_ADD: "@pdf-outline/add",
    OUTLINE_DELETE: "@pdf-outline/delete",
    OUTLINE_JUMP: "@pdf-outline/jump"
  },
  metadata: { phase: "Phase 1", priority: "medium" }
};

export default PDFOutlineFeatureConfig;

