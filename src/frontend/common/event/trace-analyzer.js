/**
 * 调用链分析器 - 提供调用链终点判断等分析功能
 * @module TraceAnalyzer
 */

export class TraceAnalyzer {
  /**
   * 判断事件是否为终点事件（基于命名规范）
   * @param {string} eventName - 事件名称
   * @returns {boolean} 是否为终点事件
   */
  static isTerminalEvent(eventName) {
    if (!eventName || typeof eventName !== 'string') return false;

    // 终点状态关键词
    const terminalStatuses = [
      'success',
      'completed',
      'complete',
      'done',
      'failed',
      'error',
      'cancelled',
      'timeout',
      'finished',
      'resolved',
      'rejected'
    ];

    const parts = eventName.split(':');
    if (parts.length !== 3) return false;

    const status = parts[2].toLowerCase();
    return terminalStatuses.includes(status);
  }

  /**
   * 从调用链树中找出所有终点节点
   * @param {Object} traceTree - 调用链树
   * @returns {Array} 终点节点列表
   */
  static findTerminalNodes(traceTree) {
    if (!traceTree || !traceTree.messages) return [];

    const terminals = [];

    function traverse(nodes) {
      nodes.forEach(node => {
        // 判断是否为终点：没有子节点或是终点事件
        const hasNoChildren = !node.children || node.children.length === 0;
        const isTerminalEvent = TraceAnalyzer.isTerminalEvent(node.event);

        if (hasNoChildren || isTerminalEvent) {
          terminals.push({
            messageId: node.messageId,
            event: node.event,
            timestamp: node.timestamp,
            executionTime: node.executionTime,
            isStructuralTerminal: hasNoChildren,  // 结构上的终点
            isSemanticTerminal: isTerminalEvent,   // 语义上的终点
            depth: getNodeDepth(traceTree, node)
          });
        }

        // 继续遍历子节点
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    }

    traverse(traceTree.messages);
    return terminals;
  }

  /**
   * 分析调用链的完成状态
   * @param {Object} traceTree - 调用链树
   * @returns {Object} 完成状态分析
   */
  static analyzeCompletion(traceTree) {
    if (!traceTree) return null;

    const terminals = TraceAnalyzer.findTerminalNodes(traceTree);
    const allNodes = TraceAnalyzer.getAllNodes(traceTree);

    // 统计成功和失败的终点
    const successTerminals = terminals.filter(t =>
      t.event.includes('success') ||
      t.event.includes('completed') ||
      t.event.includes('done')
    );

    const failureTerminals = terminals.filter(t =>
      t.event.includes('failed') ||
      t.event.includes('error') ||
      t.event.includes('rejected')
    );

    // 找出未完成的分支（非终点事件但没有子节点）
    const incompleteNodes = allNodes.filter(node => {
      const hasNoChildren = !node.children || node.children.length === 0;
      const isNotTerminal = !TraceAnalyzer.isTerminalEvent(node.event);
      return hasNoChildren && isNotTerminal;
    });

    return {
      isComplete: incompleteNodes.length === 0,
      totalNodes: allNodes.length,
      terminalNodes: terminals.length,
      successCount: successTerminals.length,
      failureCount: failureTerminals.length,
      incompleteCount: incompleteNodes.length,
      terminals: terminals,
      incompleteNodes: incompleteNodes.map(n => ({
        messageId: n.messageId,
        event: n.event,
        hint: `Event '${n.event}' appears to be incomplete (no children, not a terminal status)`
      })),
      completionRate: ((terminals.length / allNodes.length) * 100).toFixed(2) + '%'
    };
  }

  /**
   * 获取调用链的关键路径（最长路径）
   * @param {Object} traceTree - 调用链树
   * @returns {Array} 关键路径上的节点
   */
  static getCriticalPath(traceTree) {
    if (!traceTree || !traceTree.messages) return [];

    let longestPath = [];
    let maxDepth = 0;

    function findPaths(node, currentPath = []) {
      const newPath = [...currentPath, {
        messageId: node.messageId,
        event: node.event,
        executionTime: node.executionTime
      }];

      if (!node.children || node.children.length === 0) {
        // 到达终点，检查是否是最长路径
        if (newPath.length > maxDepth) {
          maxDepth = newPath.length;
          longestPath = newPath;
        }
      } else {
        // 继续遍历子节点
        node.children.forEach(child => {
          findPaths(child, newPath);
        });
      }
    }

    traceTree.messages.forEach(root => {
      findPaths(root);
    });

    return longestPath;
  }

  /**
   * 检测调用链中的异常模式
   * @param {Object} traceTree - 调用链树
   * @returns {Object} 异常模式检测结果
   */
  static detectAnomalies(traceTree) {
    const anomalies = [];
    const allNodes = TraceAnalyzer.getAllNodes(traceTree);

    // 检测1：循环调用（同一事件被多次触发）
    const eventCounts = {};
    allNodes.forEach(node => {
      eventCounts[node.event] = (eventCounts[node.event] || 0) + 1;
    });

    Object.entries(eventCounts).forEach(([event, count]) => {
      if (count > 3) {  // 同一事件触发超过3次可能是异常
        anomalies.push({
          type: 'potential_loop',
          event: event,
          count: count,
          severity: count > 10 ? 'high' : 'medium',
          message: `Event '${event}' was triggered ${count} times`
        });
      }
    });

    // 检测2：超长执行时间
    allNodes.forEach(node => {
      if (node.executionTime > 1000) {  // 执行超过1秒
        anomalies.push({
          type: 'slow_execution',
          event: node.event,
          messageId: node.messageId,
          executionTime: node.executionTime,
          severity: node.executionTime > 5000 ? 'high' : 'medium',
          message: `Event '${node.event}' took ${node.executionTime}ms to execute`
        });
      }
    });

    // 检测3：孤立节点（requested但没有对应的response）
    const requestedEvents = allNodes.filter(n => n.event.includes('requested'));
    requestedEvents.forEach(reqNode => {
      const baseName = reqNode.event.replace('requested', '');
      const hasResponse = allNodes.some(n =>
        n.event.includes(baseName) &&
        (n.event.includes('success') || n.event.includes('failed'))
      );

      if (!hasResponse) {
        anomalies.push({
          type: 'missing_response',
          event: reqNode.event,
          messageId: reqNode.messageId,
          severity: 'high',
          message: `Request '${reqNode.event}' has no corresponding response`
        });
      }
    });

    return {
      hasAnomalies: anomalies.length > 0,
      anomalyCount: anomalies.length,
      anomalies: anomalies,
      summary: {
        loops: anomalies.filter(a => a.type === 'potential_loop').length,
        slowExecutions: anomalies.filter(a => a.type === 'slow_execution').length,
        missingResponses: anomalies.filter(a => a.type === 'missing_response').length
      }
    };
  }

  // 辅助函数：获取所有节点
  static getAllNodes(traceTree) {
    if (!traceTree || !traceTree.messages) return [];

    const nodes = [];

    function traverse(nodeList) {
      nodeList.forEach(node => {
        nodes.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    }

    traverse(traceTree.messages);
    return nodes;
  }
}

// 辅助函数：获取节点深度
function getNodeDepth(traceTree, targetNode) {
  let depth = 0;

  function findDepth(nodes, currentDepth = 0) {
    for (const node of nodes) {
      if (node.messageId === targetNode.messageId) {
        depth = currentDepth;
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (findDepth(node.children, currentDepth + 1)) {
          return true;
        }
      }
    }
    return false;
  }

  findDepth(traceTree.messages);
  return depth;
}