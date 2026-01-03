import { FilterTreeNode } from "../services/filter-tree.js";
import { buildConditionConfigFromFilterTreeRoot } from "../components/filter-builder-v2-serialization.js";

function createLogicNode(operator) {
  return new FilterTreeNode({ type: "logic", value: operator });
}

function createPlaceholderNode() {
  return new FilterTreeNode({ type: "placeholder" });
}

function createConditionNode({ field, operator, value }) {
  return new FilterTreeNode({
    type: "condition",
    value: { field, operator, value },
  });
}

describe("filter-builder-v2-serialization", () => {
  test("returns empty AND composite when tree has no effective conditions", () => {
    const root = createLogicNode("AND");
    root.addChild(createPlaceholderNode());

    expect(buildConditionConfigFromFilterTreeRoot(root)).toEqual({
      type: "composite",
      operator: "AND",
      conditions: [],
    });
  });

  test("ignores placeholder nodes and converts nested logic/condition nodes", () => {
    const root = createLogicNode("AND");
    root.addChild(createPlaceholderNode());

    const orNode = root.addChild(createLogicNode("OR"));
    orNode.addChild(createPlaceholderNode());
    orNode.addChild(createConditionNode({ field: "filename", operator: "contains", value: "abc" }));

    expect(buildConditionConfigFromFilterTreeRoot(root)).toEqual({
      type: "composite",
      operator: "AND",
      conditions: [
        {
          type: "composite",
          operator: "OR",
          conditions: [
            { type: "field", field: "filename", operator: "contains", value: "abc" },
          ],
        },
      ],
    });
  });

  test("drops invalid condition nodes (missing field/operator)", () => {
    const root = createLogicNode("AND");
    root.addChild(createConditionNode({ field: "", operator: "contains", value: "x" }));
    root.addChild(createConditionNode({ field: "filename", operator: "", value: "x" }));

    expect(buildConditionConfigFromFilterTreeRoot(root)).toEqual({
      type: "composite",
      operator: "AND",
      conditions: [],
    });
  });
});

