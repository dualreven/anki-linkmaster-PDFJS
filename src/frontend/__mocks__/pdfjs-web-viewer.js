export class EventBus {
  on() {}
  off() {}
  dispatch() {}
}

export class PDFLinkService {
  constructor(opts = {}) {
    this.eventBus = opts.eventBus || new EventBus();
  }
  setViewer() {}
}

export const ScrollMode = {
  UNKNOWN: 0,
  VERTICAL: 1,
  HORIZONTAL: 2,
  WRAPPED: 3,
  PAGE: 4,
};

export const SpreadMode = {
  UNKNOWN: 0,
  NONE: 1,
  ODD: 2,
  EVEN: 3,
};

export class PDFViewer {
  constructor(opts = {}) {
    this.container = opts.container || null;
    this.viewer = opts.viewer || null;
    this.eventBus = opts.eventBus || new EventBus();
    this.linkService = opts.linkService || new PDFLinkService({ eventBus: this.eventBus });
  }
}

