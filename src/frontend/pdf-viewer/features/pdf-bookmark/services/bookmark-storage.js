/**
 * @file 书签存储抽象层
 * @module features/pdf-bookmark/services/bookmark-storage
 * @description 提供书签存储接口，方便将来切换存储方式
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../common/event/event-constants.js';

/**
 * 书签存储接口（抽象基类）
 * @interface IBookmarkStorage
 */
export class IBookmarkStorage {
  async load(pdfId) {
    throw new Error('IBookmarkStorage.load() must be implemented');
  }

  async save(pdfId, bookmarks, rootIds) {
    throw new Error('IBookmarkStorage.save() must be implemented');
  }

  async clear(pdfId) {
    throw new Error('IBookmarkStorage.clear() must be implemented');
  }
}

export class LocalStorageBookmarkStorage extends IBookmarkStorage {
  #logger;
  #storageKeyPrefix = 'pdf-viewer-bookmarks-';

  constructor() {
    super();
    this.#logger = getLogger('LocalStorageBookmarkStorage');
  }

  async load(pdfId) {
    try {
      const storageKey = `${this.#storageKeyPrefix}${pdfId}`;
      this.#logger.info(`📖 Loading bookmarks from localStorage: key=${storageKey}`);

      const data = localStorage.getItem(storageKey);
      if (!data) {
        this.#logger.info(`❌ No bookmarks found in localStorage for key: ${storageKey}`);
        return null;
      }

      const parsed = JSON.parse(data);
      this.#logger.info(`✅ Found stored data: ${parsed.bookmarks.length} bookmarks, ${parsed.rootIds.length} root IDs`);

      return {
        bookmarks: parsed.bookmarks || [],
        rootIds: parsed.rootIds || []
      };
    } catch (error) {
      this.#logger.error('Failed to load bookmarks from localStorage:', error);
      return null;
    }
  }

  async save(pdfId, bookmarks, rootIds) {
    try {
      const storageKey = `${this.#storageKeyPrefix}${pdfId}`;
      const data = {
        bookmarks,
        rootIds,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(storageKey, JSON.stringify(data));
      this.#logger.info(`✅ Bookmarks saved to localStorage: key=${storageKey}, count=${bookmarks.length}`);
    } catch (error) {
      this.#logger.error('Failed to save bookmarks to localStorage:', error);
      throw error;
    }
  }

  async clear(pdfId) {
    try {
      const storageKey = `${this.#storageKeyPrefix}${pdfId}`;
      localStorage.removeItem(storageKey);
      this.#logger.info(`✅ Bookmarks cleared from localStorage: key=${storageKey}`);
    } catch (error) {
      this.#logger.error('Failed to clear bookmarks from localStorage:', error);
      throw error;
    }
  }
}

export class RemoteBookmarkStorage extends IBookmarkStorage {
  #logger;
  #wsClient;
  #fallback;

  constructor({ wsClient, fallback } = {}) {
    super();
    this.#logger = getLogger('RemoteBookmarkStorage');
    this.#wsClient = wsClient;
    this.#fallback = fallback || null;
  }

  #canUseRemote() {
    return this.#wsClient && typeof this.#wsClient.request === 'function';
  }

  async #fallbackLoad(pdfId) {
    if (!this.#fallback) return null;
    return this.#fallback.load(pdfId);
  }

  async #fallbackSave(pdfId, bookmarks, rootIds) {
    if (!this.#fallback) return;
    await this.#fallback.save(pdfId, bookmarks, rootIds);
  }

  async #fallbackClear(pdfId) {
    if (!this.#fallback) return;
    await this.#fallback.clear(pdfId);
  }

  async load(pdfId) {
    if (!this.#canUseRemote()) {
      this.#logger.debug('Remote storage unavailable, loading from fallback');
      return this.#fallbackLoad(pdfId);
    }

    try {
      const response = await this.#wsClient.request(
        WEBSOCKET_MESSAGE_TYPES.BOOKMARK_LIST,
        { pdf_uuid: pdfId },
        { timeout: 12000 }
      );

      const normalized = {
        bookmarks: Array.isArray(response?.bookmarks) ? response.bookmarks : [],
        rootIds: response?.rootIds ?? response?.root_ids ?? []
      };

      await this.#fallbackSave(pdfId, normalized.bookmarks, normalized.rootIds);
      return normalized;
    } catch (error) {
      this.#logger.error('Failed to load bookmarks from remote:', error);
      return this.#fallbackLoad(pdfId);
    }
  }

  async save(pdfId, bookmarks, rootIds) {
    const payload = {
      pdf_uuid: pdfId,
      bookmarks: bookmarks || [],
      root_ids: rootIds || []
    };

    if (this.#canUseRemote()) {
      try {
        await this.#wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.BOOKMARK_SAVE,
          payload,
          { timeout: 7000 }
        );
      } catch (error) {
        this.#logger.error('Failed to persist bookmarks remotely, falling back to local cache:', error);
        await this.#fallbackSave(pdfId, payload.bookmarks, payload.root_ids);
        return;
      }
    }

    await this.#fallbackSave(pdfId, payload.bookmarks, payload.root_ids);
  }

  async clear(pdfId) {
    if (this.#canUseRemote()) {
      try {
        await this.#wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.BOOKMARK_SAVE,
          { pdf_uuid: pdfId, bookmarks: [], root_ids: [] },
          { timeout: 5000 }
        );
      } catch (error) {
        this.#logger.warn('Failed to clear remote bookmarks, delegating to fallback:', error);
      }
    }

    await this.#fallbackClear(pdfId);
  }
}

export function createDefaultBookmarkStorage(options = {}) {
  const fallback = new LocalStorageBookmarkStorage();
  const wsClient = options.wsClient;

  if (wsClient && typeof wsClient.request === 'function') {
    return new RemoteBookmarkStorage({ wsClient, fallback });
  }

  return fallback;
}

export default {
  IBookmarkStorage,
  LocalStorageBookmarkStorage,
  RemoteBookmarkStorage,
  createDefaultBookmarkStorage
};
