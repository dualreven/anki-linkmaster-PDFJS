import fs from "fs";

describe("new-card-scheduler entrypoint index.html - contract regression", () => {
  test("index.html module script 指向 ./index.js", () => {
    const indexHtmlUrl = new URL("../index.html", import.meta.url);
    const html = fs.readFileSync(indexHtmlUrl, { encoding: "utf8" });
    expect(html).toMatch(/<script\s+type="module"\s+src="\.\/index\.js"\s*><\/script>/);
  });
});

