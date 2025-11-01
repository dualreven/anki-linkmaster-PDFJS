// Try to ESM import Babel plugins directly
try {
  await import("@babel/plugin-transform-private-methods");
  console.log("[OK] import @babel/plugin-transform-private-methods");
  await import("@babel/plugin-syntax-dynamic-import");
  console.log("[OK] import @babel/plugin-syntax-dynamic-import");
  await import("@babel/plugin-transform-class-properties");
  console.log("[OK] import @babel/plugin-transform-class-properties");
  process.exit(0);
} catch (e) {
  console.error("[ERROR] ESM import failed");
  console.error(String((e && e.stack) || e));
  process.exit(1);
}
