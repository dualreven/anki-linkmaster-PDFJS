import { getLogger } from '../../../common/utils/logger.js';
import { featureConfig } from './feature.config.js';
import { AiAssistantSidebarUI } from './components/ai-assistant-sidebar-ui.js';
import { AiChatService } from './services/ai-chat-service.js';

export class AiAssistantFeature {
  #logger = null;
  #eventBus = null;
  #container = null;
  #annotationManager = null;
  #sidebarUI = null;
  #chatService = null;
  #enabled = false;

  get name() {
    return featureConfig.name;
  }

  get version() {
    return featureConfig.version;
  }

  get dependencies() {
    return featureConfig.dependencies || [];
  }

  async install(context) {
    const { globalEventBus, container, logger } = context;

    this.#eventBus = globalEventBus;
    this.#container = container;
    this.#logger = logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    if (!this.#container) {
      throw new Error('AiAssistantFeature requires a dependency container');
    }

    this.#annotationManager = this.#container.get('annotationManager');
    if (!this.#annotationManager) {
      this.#logger.warn('[AiAssistantFeature] annotationManager not available; AI sidebar will use empty annotation list');
    }

    this.#chatService = new AiChatService();
    this.#sidebarUI = new AiAssistantSidebarUI({
      eventBus: this.#eventBus,
      annotationManager: this.#annotationManager,
      chatService: this.#chatService,
      logger: this.#logger
    });
    this.#sidebarUI.initialize();

    this.#container.registerGlobal('aiAssistantSidebarUI', this.#sidebarUI);

    this.#enabled = true;
    this.#logger.info(`${this.name} installed successfully`);
  }

  async uninstall() {
    this.#logger?.info(`Uninstalling ${this.name}...`);
    this.#enabled = false;

    if (this.#sidebarUI) {
      this.#sidebarUI.destroy();
      this.#sidebarUI = null;
    }

    this.#chatService = null;
    this.#annotationManager = null;
    this.#eventBus = null;
    this.#container = null;

    this.#logger?.info(`${this.name} uninstalled`);
  }

  isEnabled() {
    return this.#enabled;
  }
}

export default AiAssistantFeature;
