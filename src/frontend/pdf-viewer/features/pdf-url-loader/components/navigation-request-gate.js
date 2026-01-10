export class NavigationRequestGate {
  #navInProgress = false;
  #inflightNavKey = null;
  #pendingManualNav = null; // { params, startTime }

  isBusy() {
    return this.#navInProgress;
  }

  tryEnter(key) {
    if (typeof key !== "string" || !key.trim()) {
      throw new Error("[NavigationRequestGate] key must be a non-empty string");
    }

    if (!this.#navInProgress) {
      this.#navInProgress = true;
      this.#inflightNavKey = key;
      return { accepted: true, reason: "accepted" };
    }

    if (this.#inflightNavKey === key) {
      return { accepted: false, reason: "deduped" };
    }

    return { accepted: false, reason: "busy" };
  }

  setPendingManualNav({ params, startTime }) {
    if (!this.#navInProgress) {
      throw new Error("[NavigationRequestGate] cannot set pendingManualNav when gate is not busy");
    }
    this.#pendingManualNav = { params, startTime };
  }

  consumePendingManualNav() {
    const pending = this.#pendingManualNav;
    this.#pendingManualNav = null;
    return pending;
  }

  reset() {
    this.#pendingManualNav = null;
    this.#navInProgress = false;
    this.#inflightNavKey = null;
  }
}

