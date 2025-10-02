/**
 * @file PDF UI功能域
 */

import { getLogger } from '../../../common/utils/logger.js';
import { PDFUIFeatureConfig } from './feature.config.js';

export class PDFUIFeature {
  #logger;
  #scopedEventBus;
  #enabled = false;

  get name() { return PDFUIFeatureConfig.name; }
  get version() { return PDFUIFeatureConfig.version; }
  get dependencies() { return PDFUIFeatureConfig.dependencies; }

  async install(context) {
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);
    this.#scopedEventBus = context.scopedEventBus;
    this.#logger.info(`Installing ${this.name}...`);
    this.#enabled = true;
    this.#logger.info(`${this.name} installed (placeholder)`);
  }

  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);
    this.#enabled = false;
    this.#logger.info(`${this.name} uninstalled`);
  }

  isEnabled() { return this.#enabled; }
}
