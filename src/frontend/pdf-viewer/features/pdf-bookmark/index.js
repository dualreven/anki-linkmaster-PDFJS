import { getLogger } from '../../../common/utils/logger.js';
import { PDFBookmarkFeatureConfig } from './feature.config.js';

export class PDFBookmarkFeature {
  #logger;
  #enabled = false;

  get name() { return PDFBookmarkFeatureConfig.name; }
  get version() { return PDFBookmarkFeatureConfig.version; }
  get dependencies() { return PDFBookmarkFeatureConfig.dependencies; }

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
