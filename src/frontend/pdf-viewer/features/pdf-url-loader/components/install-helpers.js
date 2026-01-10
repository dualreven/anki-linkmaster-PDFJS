import { URLParamsParser } from "./url-params-parser.js";

export function resolveContainer(context) {
  const container = context?.container || context;
  if (!container) {
    throw new Error("PDFUrlLoaderFeature.install requires a dependency container or context");
  }
  return container;
}

export function resolveDependencies({ container, context }) {
  let eventBus = context?.globalEventBus || null;
  if (!eventBus && container && typeof container.get === "function") {
    try {
      eventBus = container.get("eventBus");
    } catch {
      eventBus = null;
    }
  }

  if (!eventBus) {
    throw new Error("EventBus未在容器或context中找到");
  }

  let navigationService = null;
  if (container && typeof container.get === "function") {
    try {
      navigationService = container.get("navigationService");
    } catch {
      navigationService = null;
    }
  }

  if (!navigationService) {
    throw new Error("[url-navigation] navigationService 未在容器中找到，请确保 core-navigation Feature 已安装");
  }

  return { eventBus, navigationService };
}

export function parseAndValidateUrlParams() {
  const parsedParams = URLParamsParser.parse();
  const validation = URLParamsParser.validate(parsedParams);
  return { parsedParams, validation };
}

