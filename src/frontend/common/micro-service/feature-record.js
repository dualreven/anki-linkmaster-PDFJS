export class FeatureRecord {
  /** @type {any} */
  #feature = null;
  /** @type {any} */
  #status = null;
  /** @type {any|null} */
  #context = null;
  /** @type {Error|null} */
  #error = null;
  /** @type {number} */
  #installedAt = 0;
  /** @type {{ REGISTERED: string, INSTALLED: string }|null} */
  #featureStatus = null;

  constructor(feature, featureStatus) {
    this.#feature = feature;
    this.#featureStatus = featureStatus;
    this.#status = featureStatus.REGISTERED;
  }

  get feature() { return this.#feature; }
  get status() { return this.#status; }
  get context() { return this.#context; }
  get error() { return this.#error; }
  get installedAt() { return this.#installedAt; }

  setStatus(status) { this.#status = status; }
  setContext(context) { this.#context = context; }
  setError(error) { this.#error = error; }

  markInstalled() {
    this.#installedAt = Date.now();
    this.#status = this.#featureStatus.INSTALLED;
  }

  toJSON() {
    return {
      name: this.#feature.name,
      version: this.#feature.version,
      status: this.#status,
      dependencies: this.#feature.dependencies,
      installedAt: this.#installedAt,
      error: this.#error?.message || null,
    };
  }
}

