// integration-tests.js
// Split integration tests: load/list checks first, delete tests last

function waitForEvent(eventBus, eventName, timeout = 5000) {
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

export async function testLoadList(eventBus, app) {
  const logger = console;
  logger.info('Integration test: load list');
  let listEvent = await waitForEvent(eventBus, 'pdf:list:updated', 5000).catch(() => null);
  if (!listEvent) {
    logger.warn('No pdf:list:updated within 5s, requesting list');
    eventBus.emit('websocket:message:send', { type: 'get_pdf_list' }, { actorId: 'integration-tests' });
    listEvent = await waitForEvent(eventBus, 'pdf:list:updated', 5000).catch(() => null);
  }
  const list = listEvent && Array.isArray(listEvent) ? listEvent.slice() : [];
  logger.info('List length:', list.length);
  return list;
}

export async function testDeleteSingle(eventBus, id) {
  const logger = console;
  logger.info('Integration test: single delete for', id);
  if (!id) return null;
  eventBus.emit('pdf:remove:requested', id, { actorId: 'integration-tests' });
  const after = await waitForEvent(eventBus, 'pdf:list:updated', 8000).catch(() => null);
  logger.info('After single delete length:', Array.isArray(after) ? after.length : after);
  return after;
}

export async function testDeleteBatch(eventBus, ids) {
  const logger = console;
  logger.info('Integration test: batch delete for', ids);
  if (!Array.isArray(ids) || ids.length === 0) return null;
  eventBus.emit('pdf:batch:requested', { files: ids, timestamp: Date.now() }, { actorId: 'integration-tests' });
  const after = await waitForEvent(eventBus, 'pdf:list:updated', 10000).catch(() => null);
  logger.info('After batch delete length:', Array.isArray(after) ? after.length : after);
  return after;
}

export async function runIntegrationTests(eventBus, app) {
  const logger = console;
  logger.info('Integration tests: starting (load/list tests first; deletes will run last)');
  try {
    const beforeList = await testLoadList(eventBus, app);
    if (!beforeList || beforeList.length === 0) {
      logger.warn('No items to test deletions on; aborting further tests');
      return { ok: false, reason: 'no-items' };
    }

    // (place to add other non-destructive tests)

    // Run destructive tests last
    const firstId = beforeList[0].id || beforeList[0].filename;
    const afterSingle = await testDeleteSingle(eventBus, firstId);

    const currentList = Array.isArray(afterSingle) ? afterSingle : beforeList;
    const idsForBatch = currentList.slice(0, 2).map(it => it.id || it.filename).filter(Boolean);
    let afterBatch = null;
    if (idsForBatch.length > 0) {
      afterBatch = await testDeleteBatch(eventBus, idsForBatch);
    }

    return { ok: true, before: beforeList.length, afterSingle: Array.isArray(afterSingle) ? afterSingle.length : null, afterBatch: Array.isArray(afterBatch) ? afterBatch.length : null };
  } catch (err) {
    logger.error('Integration tests error:', err);
    return { ok: false, error: err.message };
  }
}
