import fs from "fs";

describe("new-card-scheduler legacy feature ws host (G) - contract regression", () => {
  test("legacy-feature 默认 wsUrl 不包含 ws://localhost:", () => {
    const fileUrl = new URL("../features/legacy/legacy-feature.js", import.meta.url);
    const content = fs.readFileSync(fileUrl, { encoding: "utf8" });
    expect(content).not.toContain("ws://localhost:");
  });
});

