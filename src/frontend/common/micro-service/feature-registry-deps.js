export function resolveInstallOrder({ features, resolveName }) {
  if (!features || typeof features.keys !== "function") {
    throw new Error("[FeatureRegistry] resolveInstallOrder: features must be a Map-like object");
  }
  if (typeof resolveName !== "function") {
    throw new Error("[FeatureRegistry] resolveInstallOrder: resolveName must be a function");
  }

  const visited = new Set();
  const visiting = new Set();
  const order = [];

  const dfs = (name) => {
    const canonical = resolveName(name);
    if (visited.has(canonical)) { return; }

    if (visiting.has(canonical)) {
      throw new Error(`Circular dependency detected: ${canonical}`);
    }

    visiting.add(canonical);

    const record = features.get(canonical);
    if (record) {
      const feature = record.feature || record;
      const deps = feature?.dependencies || [];
      for (const depRaw of deps) {
        const dep = resolveName(depRaw);
        if (features.has(dep)) {
          dfs(dep);
        }
      }
    }

    visiting.delete(canonical);
    visited.add(canonical);
    order.push(canonical);
  };

  for (const fname of features.keys()) {
    dfs(fname);
  }

  return order;
}

export function checkMissingDependencies({ feature, resolveName, features, container, installedStatus }) {
  if (!feature || typeof feature !== "object") {
    throw new Error("[FeatureRegistry] checkMissingDependencies: feature must be an object");
  }
  if (typeof resolveName !== "function") {
    throw new Error("[FeatureRegistry] checkMissingDependencies: resolveName must be a function");
  }
  if (!features || typeof features.get !== "function") {
    throw new Error("[FeatureRegistry] checkMissingDependencies: features must be a Map-like object");
  }
  if (!container || typeof container.has !== "function") {
    throw new Error("[FeatureRegistry] checkMissingDependencies: container must support has(name)");
  }
  if (typeof installedStatus !== "string" || !installedStatus) {
    throw new Error("[FeatureRegistry] checkMissingDependencies: installedStatus must be a non-empty string");
  }

  const missing = [];
  const deps = Array.isArray(feature.dependencies) ? feature.dependencies : [];

  for (const depRaw of deps) {
    const dep = resolveName(depRaw);
    const depRecord = features.get(dep);

    if (!depRecord) {
      if (!container.has(dep)) {
        missing.push(dep);
      }
      continue;
    }

    if (depRecord.status !== installedStatus) {
      missing.push(dep);
    }
  }

  return missing;
}
