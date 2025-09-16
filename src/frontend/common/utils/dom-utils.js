/**
 * @file DOM操作工具类，提供一组静态方法来简化和封装常用的DOM操作。
 * @module DOMUtils
 */

/**
 * @class DOMUtils
 * @description 一个包含静态DOM操作辅助方法的工具类。
 */
export class DOMUtils {
  /**
   * 创建一个HTML元素并设置其属性。
   * @param {string} tagName - 元素的HTML标签名。
   * @param {object} [attributes={}] - 一个包含键值对的属性对象。
   * @param {string|Node} [content=null] - 元素的文本内容或一个子Node节点。
   * @returns {HTMLElement} 新创建的HTML元素。
   */
  static createElement(tagName, attributes = {}, content = null) {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === "className") element.className = value;
      else if (key === "innerHTML") element.innerHTML = value;
      else element.setAttribute(key, value);
    });
    if (content) {
      if (content instanceof Node) element.appendChild(content);
      else element.textContent = content;
    }
    return element;
  }

  /**
   * 在文档或指定父元素中查找第一个匹配的元素。
   * @param {string} selector - CSS选择器。
   * @param {Document|HTMLElement} [parent=document] - 在其中进行搜索的父元素。
   * @returns {HTMLElement|null} 找到的第一个元素，如果未找到则返回null。
   */
  static findElement(selector, parent = document) {
    return parent.querySelector(selector);
  }

  /**
   * 在文档或指定父元素中查找所有匹配的元素。
   * @param {string} selector - CSS选择器。
   * @param {Document|HTMLElement} [parent=document] - 在其中进行搜索的父元素。
   * @returns {NodeListOf<HTMLElement>} 包含所有找到元素的NodeList。
   */
  static findAllElements(selector, parent = document) {
    return parent.querySelectorAll(selector);
  }
  
  /**
   * 通过ID快速获取元素。
   * @param {string} id - 元素的ID。
   * @returns {HTMLElement|null} 找到的元素，如果不存在则返回null。
   */
  static getElementById(id) {
    return document.getElementById(id);
  }

  /**
   * 为一个或多个元素添加CSS类。
   * @param {HTMLElement|NodeListOf<HTMLElement>} elements - 单个元素或元素列表。
   * @param {string} className - 要添加的CSS类名。
   */
  static addClass(elements, className) {
    const a = Array.isArray(elements) ? elements : (elements instanceof NodeList ? Array.from(elements) : [elements]);
    a.forEach(el => el?.classList.add(className));
  }

  /**
   * 从一个或多个元素移除CSS类。
   * @param {HTMLElement|NodeListOf<HTMLElement>} elements - 单个元素或元素列表。
   * @param {string} className - 要移除的CSS类名。
   */
  static removeClass(elements, className) {
    const a = Array.isArray(elements) ? elements : (elements instanceof NodeList ? Array.from(elements) : [elements]);
    a.forEach(el => el?.classList.remove(className));
  }

  /**
   * 切换元素的CSS类。
   * @param {HTMLElement} element - 目标元素。
   * @param {string} className - 要切换的CSS类名。
   * @param {boolean} [force] - 如果为true则添加类，为false则移除类。
   */
  static toggleClass(element, className, force) {
    element?.classList.toggle(className, force);
  }

  /**
   * 检查元素是否含有指定的CSS类。
   * @param {HTMLElement} element - 目标元素。
   * @param {string} className - 要检查的CSS类名。
   * @returns {boolean} 如果元素含有该类，则返回true。
   */
  static hasClass(element, className) {
    return element?.classList.contains(className) || false;
  }

  /**
   * 显示一个或多个元素。
   * @param {HTMLElement|NodeListOf<HTMLElement>} elements - 单个元素或元素列表。
   */
  static show(elements) {
    const a = Array.isArray(elements) ? elements : (elements instanceof NodeList ? Array.from(elements) : [elements]);
    a.forEach(el => { if(el) el.style.display = ""; });
  }

  /**
   * 隐藏一个或多个元素。
   * @param {HTMLElement|NodeListOf<HTMLElement>} elements - 单个元素或元素列表。
   */
  static hide(elements) {
    const a = Array.isArray(elements) ? elements : (elements instanceof NodeList ? Array.from(elements) : [elements]);
    a.forEach(el => { if(el) el.style.display = "none"; });
  }
  
  /**
   * 检查元素当前是否可见。
   * @param {HTMLElement} element - 目标元素。
   * @returns {boolean} 如果元素可见，则返回true。
   */
  static isVisible(element) {
    return !!element && element.offsetParent !== null;
  }

  /**
   * 向指定的父元素追加一个子元素。
   * @param {HTMLElement} parent - 父元素。
   * @param {HTMLElement} child - 要追加的子元素。
   */
  static appendChild(parent, child) {
    parent?.appendChild(child);
  }

  /**
   * 清空一个元素的所有子节点。
   * @param {HTMLElement} element - 目标元素。
   */
  static empty(element) {
    if (element) {
      element.innerHTML = "";
    }
  }

  /**
   * 设置元素的HTML内容。
   * @param {HTMLElement} element - 目标元素。
   * @param {string} html - 要设置的HTML字符串。
   */
  static setHTML(element, html) {
    if (element) {
      element.innerHTML = html;
    }
  }

  /**
   * Show an error message to the user. Attempts non-blocking UI first, falls back to alert.
   * @param {string} message
   */
  static showError(message) {
    try {
      const errEl = document.getElementById('global-error');
      if (errEl) {
        errEl.textContent = message;
        errEl.style.display = '';
        return;
      }
    } catch (e) {}
    try { console.error(message); } catch (e) {}
    // try { alert(message); } catch (e) {}
  }

  /**
   * Show a success message to the user. Attempts non-blocking UI first, falls back to alert.
   * @param {string} message
   */
  static showSuccess(message) {
    try {
      const okEl = document.getElementById('global-success');
      if (okEl) {
        okEl.textContent = message;
        okEl.style.display = '';
        return;
      }
    } catch (e) {}
    try { console.info(message); } catch (e) {}
    // try { alert(message); } catch (e) {}
  }
  
  /**
   * 获取元素的指定data-*属性值。
   * @param {HTMLElement} element - 目标元素。
   * @param {string} key - data属性的键名 (不含'data-')。
   * @returns {string|null} 属性值。
   */
  static getAttribute(element, key) {
      return element?.getAttribute(key);
  }
  
  /**
   * 从事件目标开始，向上查找第一个匹配选择器的祖先元素。
   * @param {HTMLElement} element - 起始元素。
   * @param {string} selector - CSS选择器。
   * @returns {HTMLElement|null} 找到的祖先元素。
   */
  static closest(element, selector) {
    return element?.closest(selector);
  }

  /**
   * 为一个或多个元素添加事件监听器。
   * @param {HTMLElement|NodeListOf<HTMLElement>|Window|Document} elements - 目标元素或元素列表。
   * @param {string} eventType - 事件类型 (如 'click')。
   * @param {Function} handler - 事件处理函数。
   * @param {object} [options] - addEventListener的选项。
   */
  static addEventListener(elements, eventType, handler, options = {}) {
    const els = (elements instanceof NodeList) ? Array.from(elements) : [elements];
    els.forEach(el => el?.addEventListener(eventType, handler, options));
  }

  /**
   * 从一个或多个元素移除事件监听器。
   * @param {HTMLElement|NodeListOf<HTMLElement>|Window|Document} elements - 目标元素或元素列表。
   * @param {string} eventType - 事件类型 (如 'click')。
   * @param {Function} handler - 事件处理函数。
   * @param {object} [options] - removeEventListener的选项。
   */
  static removeEventListener(elements, eventType, handler, options = {}) {
    const els = (elements instanceof NodeList) ? Array.from(elements) : [elements];
    els.forEach(el => el?.removeEventListener(eventType, handler, options));
   }
}

export default DOMUtils;
