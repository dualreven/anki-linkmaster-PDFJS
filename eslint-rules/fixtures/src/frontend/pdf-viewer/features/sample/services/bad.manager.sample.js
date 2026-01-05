import { PDF_VIEWER_EVENTS } from "../../../../../../common/event/pdf-viewer-constants.js";

export class BadManager {
  #eventBus;

  constructor(eventBus) {
    this.#eventBus = eventBus;
  }

  init() {
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, () => {}, { subscriberId: "BadManager" });
  }
}

