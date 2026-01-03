export function validateFeature(feature) {
  if (!feature || typeof feature !== "object") {
    throw new Error("Feature must be an object");
  }

  const requiredProps = ["name", "version", "dependencies", "install", "uninstall"];

  for (const prop of requiredProps) {
    if (!(prop in feature)) {
      throw new Error(`Feature is missing required property: ${prop}`);
    }
  }

  if (typeof feature.name !== "string" || feature.name.trim() === "") {
    throw new Error("Feature.name must be a non-empty string");
  }

  if (typeof feature.version !== "string" || feature.version.trim() === "") {
    throw new Error("Feature.version must be a non-empty string");
  }

  if (!Array.isArray(feature.dependencies)) {
    throw new Error("Feature.dependencies must be an array");
  }

  if (typeof feature.install !== "function") {
    throw new Error("Feature.install must be a function");
  }

  if (typeof feature.uninstall !== "function") {
    throw new Error("Feature.uninstall must be a function");
  }

  if ("enable" in feature && typeof feature.enable !== "function") {
    throw new Error("Feature.enable must be a function");
  }

  if ("disable" in feature && typeof feature.disable !== "function") {
    throw new Error("Feature.disable must be a function");
  }
}

