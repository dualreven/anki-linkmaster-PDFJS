import { ObservableState } from "../../../../common/utils/observable.js";

/**
 * Manages Sidebar State (Registration, Active, Widths).
 */
export class SidebarManager {
  constructor(logger) {
    this.logger = logger;

    this.store = new ObservableState({
      activeSidebars: [], // Array of IDs
      widths: {},         // ID -> width
      registeredSidebars: {} // ID -> Config (Metadata)
    }, {
      name: "SidebarStore",
      logger: this.logger
    });
  }

  registerSidebar(config) {
    if (!config || !config.id) {
      this.logger.error("[SidebarManager] Invalid config");
      return;
    }
    const current = this.store.get().registeredSidebars;
    if (current[config.id]) {
      this.logger.warn(`[SidebarManager] Sidebar already registered: ${config.id}`);
      return;
    }

    this.store.set({
      registeredSidebars: { ...current, [config.id]: config }
    });
  }

  openSidebar(id) {
    const { activeSidebars, registeredSidebars } = this.store.get();
    if (!registeredSidebars[id]) {
      this.logger.error(`[SidebarManager] Sidebar not registered: ${id}`);
      return;
    }
    if (activeSidebars.includes(id)) {return;}

    this.store.set({
      activeSidebars: [...activeSidebars, id]
    });
    this.logger.info(`[SidebarManager] Opened: ${id}`);
  }

  closeSidebar(id) {
    const { activeSidebars } = this.store.get();
    if (!activeSidebars.includes(id)) {return;}

    this.store.set({
      activeSidebars: activeSidebars.filter(sid => sid !== id)
    });
    this.logger.info(`[SidebarManager] Closed: ${id}`);
  }

  toggleSidebar(id) {
    const { activeSidebars } = this.store.get();
    if (activeSidebars.includes(id)) {
      this.closeSidebar(id);
    } else {
      this.openSidebar(id);
    }
  }

  setWidth(id, width) {
    const { registeredSidebars, widths } = this.store.get();
    const config = registeredSidebars[id];
    if (!config) {return;}

    const constrained = Math.max(
      config.minWidth || 0,
      Math.min(config.maxWidth || Infinity, width)
    );

    this.store.set({
      widths: { ...widths, [id]: constrained }
    });
  }

  getSidebar(id) {
    return this.store.get().registeredSidebars[id];
  }

  destroy() {
    // Cleanup
  }
}
