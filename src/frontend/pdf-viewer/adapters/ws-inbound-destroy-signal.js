const destroySignalByEventBus = new WeakMap();

export function setInboundDestroySignal(eventBus, signal) {
  if (!eventBus) {
    throw new Error("[ws-inbound] eventBus is required");
  }
  if (signal) {
    destroySignalByEventBus.set(eventBus, signal);
    return;
  }
  destroySignalByEventBus.delete(eventBus);
}

export function getInboundDestroySignal(eventBus) {
  if (!eventBus) {
    throw new Error("[ws-inbound] eventBus is required");
  }
  return destroySignalByEventBus.get(eventBus) || null;
}
