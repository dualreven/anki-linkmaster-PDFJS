// integration-tests.js
// Simple automated integration test runner for pdf-home TableWrapper + EventBus

export async function runIntegrationTests(eventBus, app) {
  const logger = console;
  logger.info('Integration tests: starting');

  function waitForEvent(eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const unsub = eventBus.on(eventName, (data) => {
        if (done) return;
        done = true;
        try { if (typeof unsub === 'function') unsub(); } catch (e) {}
        resolve(data);
      }, { subscriberId: `integration-tests-${eventName}` });
      setTimeout(() => {
        if (done) return;
        done = true;
        try { if (typeof unsub === 'function') unsub(); } catch (e) {}
        reject(new Error('timeout waiting for ' + eventName));
      }, timeout);
    });
  }

  try {
    // 1) initial snapshot
    const initial = app.getState ? app.getState() : { pdfCount: null };
    logger.info('Initial app state:', initial);

    // 2) verify table data loaded
    let listEvent = await waitForEvent('pdf:list:updated', 5000).catch(e => null);
    if (!listEvent) {
      logger.warn('No pdf:list:updated seen within 5s, attempting to request list');
      eventBus.emit('websocket:message:send', { type: 'get_pdf_list' }, { actorId: 'integration-tests' });
      listEvent = await waitForEvent('pdf:list:updated', 5000).catch(e => { logger.error('Still no list update'); return null; });
    }

    const beforeList = listEvent && Array.isArray(listEvent) ? listEvent.slice() : [];
    logger.info('List length before tests:', beforeList.length);

    if (beforeList.length === 0) {
      logger.warn('No items to test deletions on; aborting tests');
      return { ok: false, reason: 'no-items' };
    }

    // 3) Single delete test: remove first item via event bus
    const firstId = beforeList[0].id || beforeList[0].filename;
    logger.info('Single delete test, requesting remove of', firstId);
    eventBus.emit('pdf:remove:requested', firstId, { actorId: 'integration-tests' });

    // wait for list updated
    const afterSingle = await waitForEvent('pdf:list:updated', 8000).catch(e => { logger.error('timeout after single delete'); return null; });
    logger.info('List after single delete:', Array.isArray(afterSingle) ? afterSingle.length : afterSingle);

    // 4) Batch delete test: pick next two ids (if available)
    const currentList = Array.isArray(afterSingle) ? afterSingle : beforeList;
    const idsForBatch = currentList.slice(0, 2).map(it => it.id || it.filename).filter(Boolean);
    if (idsForBatch.length === 0) {
      logger.warn('No items left for batch test');
      return { ok: true, detail: 'single-delete-tested' };
    }

    logger.info('Batch delete test, requesting batch remove of', idsForBatch);
    eventBus.emit('pdf:batch:requested', { files: idsForBatch, timestamp: Date.now() }, { actorId: 'integration-tests' });

    const afterBatch = await waitForEvent('pdf:list:updated', 10000).catch(e => { logger.error('timeout after batch delete'); return null; });
    logger.info('List after batch delete:', Array.isArray(afterBatch) ? afterBatch.length : afterBatch);

    return { ok: true, before: beforeList.length, afterSingle: Array.isArray(afterSingle) ? afterSingle.length : null, afterBatch: Array.isArray(afterBatch) ? afterBatch.length : null };
  } catch (err) {
    logger.error('Integration tests error:', err);
    return { ok: false, error: err.message };
  }
}
