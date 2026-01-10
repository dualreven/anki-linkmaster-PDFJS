import fs from "node:fs";
import path from "node:path";

describe("pdf-search — subscriptions layer boundary guard", () => {
  test("search-box-event-subscriptions.js must not touch DOM APIs", () => {
    const filePath = path.resolve(__dirname, "../components/search-box-event-subscriptions.js");
    const content = fs.readFileSync(filePath, { encoding: "utf8" });

    const forbidden = [
      "document.",
      "window.",
      "getElementById(",
      "querySelector(",
      "querySelectorAll(",
      "addEventListener(",
      "removeEventListener(",
      "classList.",
      "createElement(",
    ];

    const hits = forbidden.filter((s) => content.includes(s));
    expect(hits).toEqual([]);
  });
});

