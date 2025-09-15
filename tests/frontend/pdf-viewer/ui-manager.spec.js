/**
 * @file ui-manager.spec.js
 * @description Jest + jsdom test to ensure UIManager reuses an existing #pdf-canvas element
 *
 * Notes:
 * - This test is defensive about how UIManager is exported/constructed.
 * - It only asserts DOM-level behavior: after initialization there must be exactly one element with id="pdf-canvas"
 *   and the original static canvas should be reused (not duplicated).
 *
 * Run: npm test (ensure jest is configured to pick up tests/)
 */

describe('PDF Viewer UIManager - canvas reuse', () => {
  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
  });

  test('should reuse existing #pdf-canvas in container and not create duplicate', async () => {
    // Arrange: create container and a static canvas inside it (simulates index.html)
    const container = document.createElement('div');
    container.id = 'pdf-viewer-container';
    const staticCanvas = document.createElement('canvas');
    staticCanvas.id = 'pdf-canvas';
    container.appendChild(staticCanvas);
    document.body.appendChild(container);

    // Defensive import: support default export, named export, or module itself
    const mod = require('../../../src/frontend/pdf-viewer/ui-manager.js');
    const UIManagerExport = mod && (mod.default || mod.UIManager || mod);

    // Attempt to initialize the UIManager in multiple plausible ways
    let initialized = false;
    try {
      // If UIManager is a constructor/class
      if (typeof UIManagerExport === 'function') {
        // Try common constructor signatures
        let ui;
        try {
          // try new UIManager(container)
          ui = new UIManagerExport(container);
        } catch (e1) {
          try {
            // try new UIManager({ container })
            ui = new UIManagerExport({ container });
          } catch (e2) {
            // try no-arg and then call init with container
            ui = new UIManagerExport();
            if (typeof ui.initialize === 'function') {
              await ui.initialize(container);
            } else if (typeof ui.initializeElements === 'function') {
              await ui.initializeElements(container);
            } else if (typeof ui.init === 'function') {
              await ui.init(container);
            }
          }
        }

        // If constructed instance has an init method, try calling it
        if (ui) {
          if (typeof ui.initialize === 'function') {
            await ui.initialize();
          } else if (typeof ui.initializeElements === 'function') {
            await ui.initializeElements();
          } else if (typeof ui.init === 'function') {
            await ui.init();
          }
        }
        initialized = true;
      } else if (typeof UIManagerExport === 'object' && UIManagerExport !== null) {
        // If module exposes an initializeElements function directly
        if (typeof UIManagerExport.initializeElements === 'function') {
          await UIManagerExport.initializeElements(container);
          initialized = true;
        } else if (typeof UIManagerExport.init === 'function') {
          await UIManagerExport.init(container);
          initialized = true;
        } else if (typeof UIManagerExport.initialize === 'function') {
          await UIManagerExport.initialize(container);
          initialized = true;
        }
      }
    } catch (err) {
      // If initialization threw, make test fail with helpful message
      throw new Error('Failed to initialize UIManager during test. Error: ' + (err && err.message ? err.message : String(err)));
    }

    // If we could not determine how to initialize UIManager, fail the test with guidance
    if (!initialized) {
      throw new Error('UIManager module loaded but test could not find a supported constructor or initializer. Please ensure ui-manager exports a usable class or initializer for tests.');
    }

    // Assert: exactly one element with id="pdf-canvas" exists in the document
    const canvases = document.querySelectorAll('#pdf-canvas');
    expect(canvases.length).toBe(1);

    // Assert: the reused canvas is exactly the same as the original staticCanvas appended before init
    const found = document.getElementById('pdf-canvas');
    expect(found).toBe(staticCanvas);
  });
});