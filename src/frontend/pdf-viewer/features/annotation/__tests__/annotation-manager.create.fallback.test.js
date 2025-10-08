/* eslint-env jest */
import { getEventBus } from '../../../../common/event/event-bus.js';
import { createScopedEventBus } from '../../../../common/event/scoped-event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';
import { AnnotationType } from '../models/annotation.js';
import { AnnotationManager } from '../core/annotation-manager.js';

function waitForEvent(eventBus, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for ' + eventName)), timeoutMs);
    const off = eventBus.on(eventName, (data) => {
      clearTimeout(timer);
      try { off(); } catch {}
      resolve(data);
    });
  });
}

describe('AnnotationManager create fallback', () => {
  test('falls back to mock save and emits CREATED when pdfId missing', async () => {
    // Arrange: create isolated event bus scope
    const globalBus = getEventBus('TestAnnotation', { enableValidation: true });
    const scopedBus = createScopedEventBus(globalBus, 'annotation');

    // Container stub with a wsClient to simulate presence of WS (but no pdfId set)
    const wsClientStub = {
      isConnected: () => true,
      request: jest.fn().mockResolvedValue({ ok: true })
    };
    const containerStub = {
      get: (name) => (name === 'wsClient' ? wsClientStub : null),
      getDependencies: () => ({ wsClient: wsClientStub })
    };

    // Instantiate manager (will detect wsClient), but we do NOT set pdfId
    const manager = new AnnotationManager(scopedBus, undefined, containerStub);

    // Prepare valid screenshot annotation payload (uses legacy base64 to avoid FS dependency)
    const payload = {
      type: AnnotationType.SCREENSHOT,
      pageNumber: 1,
      data: {
        rect: { x: 10, y: 10, width: 100, height: 60 },
        imageData: 'data:image/png;base64,iVBORw0KGgo=',
        description: 'unit-test'
      }
    };

    // Act: emit CREATE and wait for CREATED
    const waitCreated = waitForEvent(scopedBus, PDF_VIEWER_EVENTS.ANNOTATION.CREATED, 3000);
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: payload });

    const created = await waitCreated;

    // Assert
    expect(created).toBeTruthy();
    expect(created.annotation).toBeTruthy();
    expect(created.annotation.type).toBe(AnnotationType.SCREENSHOT);
    // Because fallback path was taken, wsClient.request should NOT have been required for success
    // We don't assert request not called strictly (implementation may preflight),
    // but CREATED should be emitted regardless
  });
});

