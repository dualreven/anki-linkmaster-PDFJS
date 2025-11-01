// UTF-8 encoding enforced by editor; ensure LF newlines
// Minimal script to verify that @babel/plugin-syntax-dynamic-import resolves
import { createRequire } from "module";
import { resolve } from "path";

try {
  const req = createRequire(resolve(process.cwd(), "package.json"));
  const path1 = req.resolve("@babel/plugin-syntax-dynamic-import");
  console.log(path1);
  process.exit(0);
} catch (e) {
  console.error("[ERROR] Failed to resolve @babel/plugin-syntax-dynamic-import");
  console.error(String(e && e.stack || e));
  process.exit(1);
}
