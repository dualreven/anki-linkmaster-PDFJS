/**
 * DOM Utils Module
 * 提供DOM操作的实用工具函数
 */

/**
 * 创建元素并设置属性
 * @param {string} tagName - 标签名
 * @param {Object} attributes - 属性对象
 * @param {string|Node} content - 内容（可选）
 * @returns {HTMLElement}
 */
function createElement(tagName, attributes = {}, content = null) {
  const element = document.createElement(tagName);
  
  // 设置属性
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'innerHTML') {
      element.innerHTML = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  // 设置内容
  if (content !== null) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof Node) {
      element.appendChild(content);
    }
  }
  
  return element;
}

/**
 * 查找元素
 * @param {string} selector - CSS选择器
 * @param {HTMLElement} parent - 父元素（可选，默认为document）
 * @returns {HTMLElement|null}
 */
function findElement(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * 查找所有匹配的元素
 * @param {string} selector - CSS选择器
 * @param {HTMLElement} parent - 父元素（可选，默认为document）
 * @returns {NodeList}
 */
function findAllElements(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * 通过ID获取元素
 * @param {string} id - 元素ID
 * @returns {HTMLElement|null}
 */
function getElementById(id) {
  return document.getElementById(id);
}

/**
 * 添加类名
 * @param {HTMLElement|NodeList} elements - 元素或元素列表
 * @param {string} className - 类名
 */
function addClass(elements, className) {
  if (elements instanceof NodeList) {
    elements.forEach(element => element.classList.add(className));
  } else if (elements instanceof HTMLElement) {
    elements.classList.add(className);
  }
}

/**
 * 移除类名
 * @param {HTMLElement|NodeList} elements - 元素或元素列表
 * @param {string} className - 类名
 */
function removeClass(elements, className) {
  if (elements instanceof NodeList) {
    elements.forEach(element => element.classList.remove(className));
  } else if (elements instanceof HTMLElement) {
    elements.classList.remove(className);
  }
}

/**
 * 切换类名
 * @param {HTMLElement} element - 元素
 * @param {string} className - 类名
 * @param {boolean} force - 强制添加或移除（可选）
 */
function toggleClass(element, className, force) {
  element.classList.toggle(className, force);
}

/**
 * 检查元素是否有指定类名
 * @param {HTMLElement} element - 元素
 * @param {string} className - 类名
 * @returns {boolean}
 */
function hasClass(element, className) {
  return element.classList.contains(className);
}

/**
 * 显示元素
 * @param {HTMLElement|NodeList} elements - 元素或元素列表
 */
function show(elements) {
  if (elements instanceof NodeList) {
    elements.forEach(element => {
      element.style.display = '';
    });
  } else if (elements instanceof HTMLElement) {
    elements.style.display = '';
  }
}

/**
 * 隐藏元素
 * @param {HTMLElement|NodeList} elements - 元素或元素列表
 */
function hide(elements) {
  if (elements instanceof NodeList) {
    elements.forEach(element => {
      element.style.display = 'none';
    });
  } else if (elements instanceof HTMLElement) {
    elements.style.display = 'none';
  }
}

/**
 * 设置元素样式
 * @param {HTMLElement|NodeList} elements - 元素或元素列表
 * @param {Object} styles - 样式对象
 */
function setStyle(elements, styles) {
  const applyStyles = (element) => {
    Object.entries(styles).forEach(([property, value]) => {
      element.style[property] = value;
    });
  };
  
  if (elements instanceof NodeList) {
    elements.forEach(applyStyles);
  } else if (elements instanceof HTMLElement) {
    applyStyles(elements);
  }
}

/**
 * 添加事件监听器
 * @param {HTMLElement|NodeList} elements - 元素或元素列表
 * @param {string} eventType - 事件类型
 * @param {Function} handler - 事件处理函数
 * @param {Object} options - 事件选项（可选）
 */
function addEventListener(elements, eventType, handler, options = {}) {
  if (elements instanceof NodeList) {
    elements.forEach(element => {
      element.addEventListener(eventType, handler, options);
    });
  } else if (elements instanceof HTMLElement) {
    elements.addEventListener(eventType, handler, options);
  }
}

/**
 * 移除事件监听器
 * @param {HTMLElement|NodeList} elements - 元素或元素列表
 * @param {string} eventType - 事件类型
 * @param {Function} handler - 事件处理函数
 * @param {Object} options - 事件选项（可选）
 */
function removeEventListener(elements, eventType, handler, options = {}) {
  if (elements instanceof NodeList) {
    elements.forEach(element => {
      element.removeEventListener(eventType, handler, options);
    });
  } else if (elements instanceof HTMLElement) {
    elements.removeEventListener(eventType, handler, options);
  }
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} - 防抖处理后的函数
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} - 节流处理后的函数
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 设置元素属性
 * @param {HTMLElement} element - 元素
 * @param {string|Object} name - 属性名或属性对象
 * @param {string} value - 属性值（如果name是字符串）
 */
function setAttribute(element, name, value) {
  if (typeof name === 'object') {
    Object.entries(name).forEach(([key, val]) => {
      element.setAttribute(key, val);
    });
  } else {
    element.setAttribute(name, value);
  }
}

/**
 * 获取元素属性
 * @param {HTMLElement} element - 元素
 * @param {string} name - 属性名
 * @returns {string} 属性值
 */
function getAttribute(element, name) {
  return element.getAttribute(name);
}

/**
 * 移除元素属性
 * @param {HTMLElement} element - 元素
 * @param {string} name - 属性名
 */
function removeAttribute(element, name) {
  element.removeAttribute(name);
}

/**
 * 设置元素内容
 * @param {HTMLElement} element - 元素
 * @param {string|Node} content - 内容
 */
function setContent(element, content) {
  if (typeof content === 'string') {
    element.textContent = content;
  } else if (content instanceof Node) {
    element.innerHTML = '';
    element.appendChild(content);
  }
}

/**
 * 获取元素内容
 * @param {HTMLElement} element - 元素
 * @returns {string} 元素内容
 */
function getContent(element) {
  return element.textContent;
}

/**
 * 设置元素HTML
 * @param {HTMLElement} element - 元素
 * @param {string} html - HTML字符串
 */
function setHTML(element, html) {
  element.innerHTML = html;
}

/**
 * 获取元素HTML
 * @param {HTMLElement} element - 元素
 * @returns {string} HTML字符串
 */
function getHTML(element) {
  return element.innerHTML;
}

/**
 * 添加子元素
 * @param {HTMLElement} parent - 父元素
 * @param {HTMLElement|Node} child - 子元素
 * @param {HTMLElement} referenceNode - 参考节点（可选，如果提供，则在此节点前插入）
 */
function appendChild(parent, child, referenceNode = null) {
  if (referenceNode) {
    parent.insertBefore(child, referenceNode);
  } else {
    parent.appendChild(child);
  }
}

/**
 * 移除子元素
 * @param {HTMLElement} parent - 父元素
 * @param {HTMLElement} child - 子元素
 */
function removeChild(parent, child) {
  parent.removeChild(child);
}

/**
 * 移除元素
 * @param {HTMLElement} element - 要移除的元素
 */
function removeElement(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * 清空元素内容
 * @param {HTMLElement} element - 元素
 */
function empty(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * 获取元素尺寸
 * @param {HTMLElement} element - 元素
 * @returns {Object} 包含width和height的对象
 */
function getSize(element) {
  return {
    width: element.offsetWidth,
    height: element.offsetHeight
  };
}

/**
 * 获取元素位置
 * @param {HTMLElement} element - 元素
 * @returns {Object} 包含top和left的对象
 */
function getPosition(element) {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.pageYOffset,
    left: rect.left + window.pageXOffset
  };
}

/**
 * 检查元素是否可见
 * @param {HTMLElement} element - 元素
 * @returns {boolean} 是否可见
 */
function isVisible(element) {
  return element.offsetParent !== null;
}

/**
 * 获取表单数据
 * @param {HTMLFormElement} form - 表单元素
 * @returns {Object} 表单数据对象
 */
function getFormData(form) {
  const formData = {};
  const elements = form.elements;
  
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.name) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        formData[element.name] = element.checked;
      } else {
        formData[element.name] = element.value;
      }
    }
  }
  
  return formData;
}

/**
 * 设置表单数据
 * @param {HTMLFormElement} form - 表单元素
 * @param {Object} data - 数据对象
 */
function setFormData(form, data) {
  const elements = form.elements;
  
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.name && data.hasOwnProperty(element.name)) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        element.checked = !!data[element.name];
      } else {
        element.value = data[element.name];
      }
    }
  }
}

/**
 * 查找最近的匹配选择器的父元素
 * @param {HTMLElement} element - 起始元素
 * @param {string} selector - CSS选择器
 * @returns {HTMLElement|null} 匹配的父元素
 */
function closest(element, selector) {
  while (element && element !== document) {
    if (element.matches(selector)) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

/**
 * 获取元素的数据属性
 * @param {HTMLElement} element - 元素
 * @param {string} key - 数据属性键（可选，不提供则返回所有数据属性）
 * @returns {string|Object} 数据属性值或所有数据属性对象
 */
function getData(element, key) {
  if (key) {
    return element.dataset[key];
  }
  return element.dataset;
}

/**
 * 设置元素的数据属性
 * @param {HTMLElement} element - 元素
 * @param {string|Object} key - 数据属性键或键值对对象
 * @param {string} value - 数据属性值（如果key是字符串）
 */
function setData(element, key, value) {
  if (typeof key === 'object') {
    Object.entries(key).forEach(([k, v]) => {
      element.dataset[k] = v;
    });
  } else {
    element.dataset[key] = value;
  }
}

/**
 * 创建并显示通知消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型（success, error, warning, info）
 * @param {number} duration - 显示时长（毫秒）
 * @returns {HTMLElement} 创建的消息元素
 */
function showNotification(message, type = 'info', duration = 3000) {
  const notification = createElement('div', { 
    className: `notification notification-${type}` 
  });
  notification.textContent = message;
  notification.style.display = 'block';
  
  document.body.appendChild(notification);
  
  // 自动隐藏
  setTimeout(() => {
    notification.style.display = 'none';
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, duration);
  
  return notification;
}

/**
 * 创建并显示错误消息
 * @param {string} message - 错误消息
 * @param {number} duration - 显示时长（毫秒）
 * @returns {HTMLElement} 创建的错误消息元素
 */
function showError(message, duration = 3000) {
  return showNotification(message, 'error', duration);
}

/**
 * 创建并显示成功消息
 * @param {string} message - 成功消息
 * @param {number} duration - 显示时长（毫秒）
 * @returns {HTMLElement} 创建的成功消息元素
 */
function showSuccess(message, duration = 3000) {
  return showNotification(message, 'success', duration);
}

// DOM工具类
class DOMUtils {
  /**
   * 创建元素并设置属性
   * @param {string} tagName - 标签名
   * @param {Object} attributes - 属性对象
   * @param {string|Node} content - 内容（可选）
   * @returns {HTMLElement}
   */
  static createElement(tagName, attributes = {}, content = null) {
    return createElement(tagName, attributes, content);
  }

  /**
   * 查找元素
   * @param {string} selector - CSS选择器
   * @param {HTMLElement} parent - 父元素（可选，默认为document）
   * @returns {HTMLElement|null}
   */
  static findElement(selector, parent = document) {
    return findElement(selector, parent);
  }

  /**
   * 查找所有匹配的元素
   * @param {string} selector - CSS选择器
   * @param {HTMLElement} parent - 父元素（可选，默认为document）
   * @returns {NodeList}
   */
  static findAllElements(selector, parent = document) {
    return findAllElements(selector, parent);
  }

  /**
   * 通过ID获取元素
   * @param {string} id - 元素ID
   * @returns {HTMLElement|null}
   */
  static getElementById(id) {
    return getElementById(id);
  }

  /**
   * 添加类名
   * @param {HTMLElement|NodeList} elements - 元素或元素列表
   * @param {string} className - 类名
   */
  static addClass(elements, className) {
    addClass(elements, className);
  }

  /**
   * 移除类名
   * @param {HTMLElement|NodeList} elements - 元素或元素列表
   * @param {string} className - 类名
   */
  static removeClass(elements, className) {
    removeClass(elements, className);
  }

  /**
   * 切换类名
   * @param {HTMLElement} element - 元素
   * @param {string} className - 类名
   * @param {boolean} force - 强制添加或移除（可选）
   */
  static toggleClass(element, className, force) {
    toggleClass(element, className, force);
  }

  /**
   * 检查元素是否有指定类名
   * @param {HTMLElement} element - 元素
   * @param {string} className - 类名
   * @returns {boolean}
   */
  static hasClass(element, className) {
    return hasClass(element, className);
  }

  /**
   * 显示元素
   * @param {HTMLElement|NodeList} elements - 元素或元素列表
   */
  static show(elements) {
    show(elements);
  }

  /**
   * 隐藏元素
   * @param {HTMLElement|NodeList} elements - 元素或元素列表
   */
  static hide(elements) {
    hide(elements);
  }

  /**
   * 设置元素样式
   * @param {HTMLElement|NodeList} elements - 元素或元素列表
   * @param {Object} styles - 样式对象
   */
  static setStyle(elements, styles) {
    setStyle(elements, styles);
  }

  /**
   * 添加事件监听器
   * @param {HTMLElement|NodeList} elements - 元素或元素列表
   * @param {string} eventType - 事件类型
   * @param {Function} handler - 事件处理函数
   * @param {Object} options - 事件选项（可选）
   */
  static addEventListener(elements, eventType, handler, options = {}) {
    addEventListener(elements, eventType, handler, options);
  }

  /**
   * 移除事件监听器
   * @param {HTMLElement|NodeList} elements - 元素或元素列表
   * @param {string} eventType - 事件类型
   * @param {Function} handler - 事件处理函数
   * @param {Object} options - 事件选项（可选）
   */
  static removeEventListener(elements, eventType, handler, options = {}) {
    removeEventListener(elements, eventType, handler, options);
  }

  /**
   * 设置元素属性
   * @param {HTMLElement} element - 元素
   * @param {string|Object} name - 属性名或属性对象
   * @param {string} value - 属性值（如果name是字符串）
   */
  static setAttribute(element, name, value) {
    setAttribute(element, name, value);
  }

  /**
   * 获取元素属性
   * @param {HTMLElement} element - 元素
   * @param {string} name - 属性名
   * @returns {string} 属性值
   */
  static getAttribute(element, name) {
    return getAttribute(element, name);
  }

  /**
   * 移除元素属性
   * @param {HTMLElement} element - 元素
   * @param {string} name - 属性名
   */
  static removeAttribute(element, name) {
    removeAttribute(element, name);
  }

  /**
   * 设置元素内容
   * @param {HTMLElement} element - 元素
   * @param {string|Node} content - 内容
   */
  static setContent(element, content) {
    setContent(element, content);
  }

  /**
   * 获取元素内容
   * @param {HTMLElement} element - 元素
   * @returns {string} 元素内容
   */
  static getContent(element) {
    return getContent(element);
  }

  /**
   * 设置元素HTML
   * @param {HTMLElement} element - 元素
   * @param {string} html - HTML字符串
   */
  static setHTML(element, html) {
    setHTML(element, html);
  }

  /**
   * 获取元素HTML
   * @param {HTMLElement} element - 元素
   * @returns {string} HTML字符串
   */
  static getHTML(element) {
    return getHTML(element);
  }

  /**
   * 添加子元素
   * @param {HTMLElement} parent - 父元素
   * @param {HTMLElement|Node} child - 子元素
   * @param {HTMLElement} referenceNode - 参考节点（可选，如果提供，则在此节点前插入）
   */
  static appendChild(parent, child, referenceNode = null) {
    appendChild(parent, child, referenceNode);
  }

  /**
   * 移除子元素
   * @param {HTMLElement} parent - 父元素
   * @param {HTMLElement} child - 子元素
   */
  static removeChild(parent, child) {
    removeChild(parent, child);
  }

  /**
   * 移除元素
   * @param {HTMLElement} element - 要移除的元素
   */
  static removeElement(element) {
    removeElement(element);
  }

  /**
   * 清空元素内容
   * @param {HTMLElement} element - 元素
   */
  static empty(element) {
    empty(element);
  }

  /**
   * 获取元素尺寸
   * @param {HTMLElement} element - 元素
   * @returns {Object} 包含width和height的对象
   */
  static getSize(element) {
    return getSize(element);
  }

  /**
   * 获取元素位置
   * @param {HTMLElement} element - 元素
   * @returns {Object} 包含top和left的对象
   */
  static getPosition(element) {
    return getPosition(element);
  }

  /**
   * 检查元素是否可见
   * @param {HTMLElement} element - 元素
   * @returns {boolean} 是否可见
   */
  static isVisible(element) {
    return isVisible(element);
  }

  /**
   * 获取表单数据
   * @param {HTMLFormElement} form - 表单元素
   * @returns {Object} 表单数据对象
   */
  static getFormData(form) {
    return getFormData(form);
  }

  /**
   * 设置表单数据
   * @param {HTMLFormElement} form - 表单元素
   * @param {Object} data - 数据对象
   */
  static setFormData(form, data) {
    setFormData(form, data);
  }

  /**
   * 查找最近的匹配选择器的父元素
   * @param {HTMLElement} element - 起始元素
   * @param {string} selector - CSS选择器
   * @returns {HTMLElement|null} 匹配的父元素
   */
  static closest(element, selector) {
    return closest(element, selector);
  }

  /**
   * 获取元素的数据属性
   * @param {HTMLElement} element - 元素
   * @param {string} key - 数据属性键（可选，不提供则返回所有数据属性）
   * @returns {string|Object} 数据属性值或所有数据属性对象
   */
  static getData(element, key) {
    return getData(element, key);
  }

  /**
   * 设置元素的数据属性
   * @param {HTMLElement} element - 元素
   * @param {string|Object} key - 数据属性键或键值对对象
   * @param {string} value - 数据属性值（如果key是字符串）
   */
  static setData(element, key, value) {
    setData(element, key, value);
  }

  /**
   * 创建并显示通知消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型（success, error, warning, info）
   * @param {number} duration - 显示时长（毫秒）
   * @returns {HTMLElement} 创建的消息元素
   */
  static showNotification(message, type = 'info', duration = 3000) {
    return showNotification(message, type, duration);
  }

  /**
   * 创建并显示错误消息
   * @param {string} message - 错误消息
   * @param {number} duration - 显示时长（毫秒）
   * @returns {HTMLElement} 创建的错误消息元素
   */
  static showError(message, duration = 3000) {
    return showError(message, duration);
  }

  /**
   * 创建并显示成功消息
   * @param {string} message - 成功消息
   * @param {number} duration - 显示时长（毫秒）
   * @returns {HTMLElement} 创建的成功消息元素
   */
  static showSuccess(message, duration = 3000) {
    return showSuccess(message, duration);
  }

  /**
   * 防抖函数
   * @param {Function} func - 要执行的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function} - 防抖处理后的函数
   */
  static debounce(func, wait) {
    return debounce(func, wait);
  }

  /**
   * 节流函数
   * @param {Function} func - 要执行的函数
   * @param {number} limit - 时间限制（毫秒）
   * @returns {Function} - 节流处理后的函数
   */
  static throttle(func, limit) {
    return throttle(func, limit);
  }
}

// 导出函数和类
export {
  // 函数
  createElement,
  findElement,
  findAllElements,
  getElementById,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  show,
  hide,
  setStyle,
  addEventListener,
  removeEventListener,
  setAttribute,
  getAttribute,
  removeAttribute,
  setContent,
  getContent,
  setHTML,
  getHTML,
  appendChild,
  removeChild,
  removeElement,
  empty,
  getSize,
  getPosition,
  isVisible,
  getFormData,
  setFormData,
  closest,
  getData,
  setData,
  showNotification,
  showError,
  showSuccess,
  debounce,
  throttle,
  // 类
  DOMUtils
};