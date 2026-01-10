import fs from "fs";
import path from "path";

describe("new-card-scheduler main ws host (H) - contract regression", () => {
  test("createNewCardSchedulerAppOrThrow 默认 host 使用 127.0.0.1（不再用 localhost）", () => {
    const p = path.resolve(process.cwd(), "src/frontend/new-card-scheduler/main.js");
    const content = fs.readFileSync(p, { encoding: "utf8" });
    expect(content).not.toContain("ws://localhost:");
    expect(content).toContain("ws://127.0.0.1:");
  });
});

