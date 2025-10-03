/**
 * 筛选条件树节点
 */
export class FilterTreeNode {
  #id = null;
  #type = null;        // 'logic' | 'condition' | 'placeholder'
  #value = null;       // logic: 'AND'|'OR'|'NOT', condition: {field, operator, value}
  #children = [];
  #parent = null;

  /**
   * @param {Object} config - 节点配置
   * @param {string} config.type - 节点类型
   * @param {any} config.value - 节点值
   * @param {FilterTreeNode} config.parent - 父节点
   */
  constructor(config = {}) {
    this.#id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.#type = config.type || 'placeholder';
    this.#value = config.value || null;
    this.#parent = config.parent || null;
    this.#children = [];
  }

  // Getters
  get id() { return this.#id; }
  get type() { return this.#type; }
  get value() { return this.#value; }
  get children() { return this.#children; }
  get parent() { return this.#parent; }

  // Setters
  set type(val) { this.#type = val; }
  set value(val) { this.#value = val; }
  set parent(val) { this.#parent = val; }

  /**
   * 添加子节点
   */
  addChild(node) {
    node.parent = this;
    this.#children.push(node);
    return node;
  }

  /**
   * 移除子节点
   */
  removeChild(node) {
    const index = this.#children.findIndex(n => n.id === node.id);
    if (index > -1) {
      this.#children.splice(index, 1);
      node.parent = null;
    }
  }

  /**
   * 获取节点层级深度
   */
  getDepth() {
    let depth = 0;
    let current = this.#parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 获取同级节点中的位置
   */
  getIndexInParent() {
    if (!this.#parent) return 0;
    return this.#parent.children.findIndex(n => n.id === this.#id);
  }

  /**
   * 在当前节点后插入同级节点
   */
  insertSiblingAfter(node) {
    if (!this.#parent) {
      throw new Error('Cannot insert sibling for root node');
    }

    const index = this.getIndexInParent();
    node.parent = this.#parent;
    this.#parent.children.splice(index + 1, 0, node);
    return node;
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      id: this.#id,
      type: this.#type,
      value: this.#value,
      children: this.#children.map(child => child.toJSON())
    };
  }

  /**
   * 转换为Python表达式
   */
  toPythonExpression() {
    if (this.#type === 'condition') {
      const { field, operator, value } = this.#value;

      // 根据操作符生成Python表达式
      switch (operator) {
        case 'contains':
          return `"${value}" in ${field}`;
        case 'not_contains':
          return `"${value}" not in ${field}`;
        case 'eq':
          return `${field} == "${value}"`;
        case 'ne':
          return `${field} != "${value}"`;
        case 'gt':
          return `${field} > ${value}`;
        case 'lt':
          return `${field} < ${value}`;
        case 'gte':
          return `${field} >= ${value}`;
        case 'lte':
          return `${field} <= ${value}`;
        case 'starts_with':
          return `${field}.startswith("${value}")`;
        case 'ends_with':
          return `${field}.endswith("${value}")`;
        case 'in_range':
          // 假设value格式为 "min,max"
          const [min, max] = value.split(',');
          return `${min} <= ${field} <= ${max}`;
        default:
          return `${field} ${operator} "${value}"`;
      }
    }

    if (this.#type === 'logic') {
      const childExpressions = this.#children
        .filter(child => child.type !== 'placeholder')
        .map(child => child.toPythonExpression());

      if (childExpressions.length === 0) return '';

      if (this.#value === 'NOT') {
        return `not (${childExpressions[0] || ''})`;
      }

      if (this.#value === 'AND') {
        return childExpressions.length === 1
          ? childExpressions[0]
          : `(${childExpressions.join(' and ')})`;
      }

      if (this.#value === 'OR') {
        return childExpressions.length === 1
          ? childExpressions[0]
          : `(${childExpressions.join(' or ')})`;
      }
    }

    return '';
  }
}

/**
 * 筛选条件树管理器
 */
export class FilterTree {
  #root = null;

  constructor() {
    // 根节点默认为AND逻辑
    this.#root = new FilterTreeNode({
      type: 'logic',
      value: 'AND'
    });

    // 添加初始占位符
    this.#root.addChild(new FilterTreeNode({
      type: 'placeholder',
      parent: this.#root
    }));
  }

  get root() { return this.#root; }

  /**
   * 根据ID查找节点
   */
  findNodeById(nodeId, startNode = this.#root) {
    if (startNode.id === nodeId) return startNode;

    for (const child of startNode.children) {
      const found = this.findNodeById(nodeId, child);
      if (found) return found;
    }

    return null;
  }

  /**
   * 获取所有节点（深度优先）
   */
  getAllNodes(startNode = this.#root) {
    const nodes = [startNode];
    for (const child of startNode.children) {
      nodes.push(...this.getAllNodes(child));
    }
    return nodes;
  }

  /**
   * 转换为Python表达式
   */
  toPythonExpression() {
    const rootExpr = this.#root.toPythonExpression();
    // 移除最外层的括号
    return rootExpr.replace(/^\((.*)\)$/, '$1');
  }

  /**
   * 转换为JSON
   */
  toJSON() {
    return this.#root.toJSON();
  }
}
