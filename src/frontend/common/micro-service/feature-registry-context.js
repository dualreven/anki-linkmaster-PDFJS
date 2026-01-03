import { getLogger } from "../utils/logger.js";
import { ScopedEventBus } from "../../common/event/scoped-event-bus.js";

export async function createFeatureContext({ featureName, container, globalEventBus, features }) {
  if (!featureName || typeof featureName !== "string") {
    throw new Error("[FeatureRegistry] createFeatureContext: featureName must be a non-empty string");
  }
  if (!container) {
    throw new Error("[FeatureRegistry] createFeatureContext: container is required");
  }

  const featureScope = container.createScope(featureName);
  const featureLogger = getLogger(`Feature.${featureName}`);

  let scopedEventBus = null;
  if (globalEventBus) {
    const record = features.get(featureName);
    const feature = record?.feature || record;
    const scopeId = (feature && (feature.constructor?.SCOPE_ID || feature.SCOPE_ID)) || featureName;
    scopedEventBus = new ScopedEventBus(globalEventBus, scopeId);
  }

  return {
    container: featureScope,
    globalEventBus,
    scopedEventBus,
    logger: featureLogger,
    config: {},
  };
}

export function cleanupFeatureContext(context) {
  if (!context) { return; }

  if (context.scopedEventBus && typeof context.scopedEventBus.destroy === "function") {
    context.scopedEventBus.destroy();
  }

  if (context.container && typeof context.container.dispose === "function") {
    context.container.dispose();
  }
}

