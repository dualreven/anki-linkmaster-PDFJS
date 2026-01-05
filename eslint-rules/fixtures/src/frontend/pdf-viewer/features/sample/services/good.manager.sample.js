import { PDF_VIEWER_EVENTS } from "../../../../../../common/event/pdf-viewer-constants.js";

export class GoodManager {
  #eventBus;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    void PDF_VIEWER_EVENTS;
  }

  init() {
    // No subscriptions in manager.
    return true;
  }
}

