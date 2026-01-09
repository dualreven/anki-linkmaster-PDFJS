import { DOMElementManager } from "../dom-element-manager.js";

describe("DOMElementManager contract", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("fails fast when viewer container missing", () => {
    document.body.innerHTML = "<div id=\"pdf-container\"></div>";
    const manager = new DOMElementManager();
    expect(() => manager.initializeElements()).toThrow(
      /Missing required DOM elements: viewer-container/
    );
  });

  test("initializes successfully when all required elements exist", () => {
    document.body.innerHTML = "<div id=\"pdf-container\"></div><div id=\"viewer-container\"></div>";
    const manager = new DOMElementManager();
    const elements = manager.initializeElements();
    expect(elements.container).not.toBeNull();
    expect(elements.viewerContainer).not.toBeNull();
  });
});
