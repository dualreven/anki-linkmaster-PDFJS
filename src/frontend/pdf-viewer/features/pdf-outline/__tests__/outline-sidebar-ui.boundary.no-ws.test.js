import fs from "fs";
import path from "path";

describe("pdf-outline: OutlineSidebarUI boundary gate", () => {
  test("components/outline-sidebar-ui.js must not subscribe via eventBus.on nor couple to WS", () => {
    const relPath = "src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js";
    const abs = path.resolve(process.cwd(), relPath);
    const code = fs.readFileSync(abs, { encoding: "utf8" });

    expect(code).not.toMatch(/\b(?:this\s*\.\s*#eventBus|eventBus)\s*\.\s*on\s*\(/);
    expect(code).not.toMatch(/\bWEBSOCKET_EVENTS\b/);
    expect(code).not.toMatch(/\bWEBSOCKET_MESSAGE_TYPES\b/);
    expect(code).not.toMatch(/\bgetWSClient\b/);
    expect(code).not.toMatch(/\bWSClient\b/);
  });
});

