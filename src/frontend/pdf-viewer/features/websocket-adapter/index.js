import { getLogger } from '../../../common/utils/logger.js';
import { WebSocketAdapterFeatureConfig } from './feature.config.js';

export class WebSocketAdapterFeature {
  #logger;
  #enabled = false;

  get name() { return WebSocketAdapterFeatureConfig.name; }
  get version() { return WebSocketAdapterFeatureConfig.version; }
  get dependencies() { return WebSocketAdapterFeatureConfig.dependencies; }

  async install(context) {
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);
    this.#logger.info(`Installing ${this.name}...`);
    this.#enabled = true;
    this.#logger.info(`${this.name} installed (placeholder)`);
  }

  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);
    this.#enabled = false;
  }

  isEnabled() { return this.#enabled; }
}
