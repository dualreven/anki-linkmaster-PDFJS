/**
 * @file 前后端通信测试工具
 * @description 在 PDF-Home 页面上提供可视化的通信测试功能
 */

import { getLogger } from '../../common/utils/logger.js';
const logger = getLogger('CommunicationTester');


/**
 * PDF 记录字段定义（用于验证）
 */
const PDF_RECORD_SCHEMA = {
    id: 'string',
    filename: 'string',
    file_path: 'string',
    file_size: 'number',
    page_count: 'number',
    created_at: 'number',
    last_accessed_at: 'number',
    review_count: 'number',
    rating: 'number',
    tags: 'array',
    is_visible: 'boolean',
    total_reading_time: 'number',
    due_date: 'number'
};

/**
 * 通信测试器类
 */
export class CommunicationTester {
    constructor(wsClient, eventBus) {
        this.wsClient = wsClient;
        this.eventBus = eventBus;
        this.testResults = [];
    }

    /**
     * 验证字段命名规范（snake_case）
     */
    isSnakeCase(fieldName) {
        return /^[a-z][a-z0-9_]*$/.test(fieldName);
    }

    /**
     * 验证数据类型
     */
    validateType(value, expectedType) {
        if (expectedType === 'array') {
            return Array.isArray(value);
        }
        return typeof value === expectedType;
    }

    /**
     * 验证 PDF 记录格式
     */
    validatePDFRecord(record) {
        const issues = [];

        // 检查必需字段
        for (const [field, expectedType] of Object.entries(PDF_RECORD_SCHEMA)) {
            if (!(field in record)) {
                issues.push({
                    type: 'error',
                    message: `缺少字段: ${field}`
                });
                continue;
            }

            // 验证命名规范
            if (!this.isSnakeCase(field)) {
                issues.push({
                    type: 'warning',
                    message: `字段命名不符合 snake_case: ${field}`
                });
            }

            // 验证数据类型
            const value = record[field];
            if (!this.validateType(value, expectedType)) {
                issues.push({
                    type: 'error',
                    message: `字段 '${field}' 类型错误: 期望 ${expectedType}, 实际 ${typeof value}`
                });
            }

            // 验证时间戳
            if (field.endsWith('_at') || field === 'due_date') {
                if (typeof value === 'number' && value > 0) {
                    // Unix 秒时间戳范围检查（2001-2286）
                    if (value < 1000000000 || value > 9999999999) {
                        issues.push({
                            type: 'warning',
                            message: `时间戳可能有误: ${field} = ${value}`
                        });
                    }
                }
            }
        }

        return issues;
    }

    /**
     * 测试 PDF 列表获取
     */
    async testPDFList() {
        return new Promise((resolve) => {
            const testResult = {
                name: 'PDF列表获取测试',
                issues: [],
                details: {}
            };

            // 监听响应
            const unsubscribe = this.eventBus.on('pdf-library:list:records', (data) => {
                try {
                    testResult.details.responseType = data?.type || 'unknown';
                    testResult.details.hasRecords = 'records' in (data?.data || {});

                    if (!data?.data?.records) {
                        testResult.issues.push({
                            type: 'error',
                            message: '响应缺少 records 字段'
                        });
                    } else {
                        const records = data.data.records;
                        testResult.details.recordCount = records.length;

                        // 验证每条记录
                        records.forEach((record, index) => {
                            const recordIssues = this.validatePDFRecord(record);
                            recordIssues.forEach(issue => {
                                testResult.issues.push({
                                    ...issue,
                                    message: `记录#${index + 1} (${record.filename}): ${issue.message}`
                                });
                            });
                        });
                    }
                } catch (error) {
                    testResult.issues.push({
                        type: 'error',
                        message: `处理响应时出错: ${error.message}`
                    });
                } finally {
                    unsubscribe();
                    resolve(testResult);
                }
            }, { subscriberId: 'communication-tester', once: true });

            // 发送请求
            try {
                this.wsClient.send({
                    type: 'pdf-library:list:records',
                    data: {}
                });
                testResult.details.requestSent = true;

                // 超时处理
                setTimeout(() => {
                    if (!testResult.details.responseType) {
                        unsubscribe();
                        testResult.issues.push({
                            type: 'error',
                            message: '请求超时（5秒无响应）'
                        });
                        resolve(testResult);
                    }
                }, 5000);
            } catch (error) {
                testResult.issues.push({
                    type: 'error',
                    message: `发送请求失败: ${error.message}`
                });
                unsubscribe();
                resolve(testResult);
            }
        });
    }

    /**
     * 测试 WebSocket 连接
     */
    testConnection() {
        const testResult = {
            name: 'WebSocket连接测试',
            issues: [],
            details: {}
        };

        // 检查 WebSocket 状态
        const wsState = this.wsClient?.ws?.readyState;
        testResult.details.readyState = wsState;

        if (wsState === WebSocket.OPEN) {
            testResult.details.status = '已连接';
        } else if (wsState === WebSocket.CONNECTING) {
            testResult.details.status = '连接中';
            testResult.issues.push({
                type: 'warning',
                message: 'WebSocket 正在连接中'
            });
        } else if (wsState === WebSocket.CLOSING) {
            testResult.details.status = '关闭中';
            testResult.issues.push({
                type: 'error',
                message: 'WebSocket 正在关闭'
            });
        } else if (wsState === WebSocket.CLOSED) {
            testResult.details.status = '已关闭';
            testResult.issues.push({
                type: 'error',
                message: 'WebSocket 已断开连接'
            });
        } else {
            testResult.details.status = '未知';
            testResult.issues.push({
                type: 'error',
                message: 'WebSocket 状态未知'
            });
        }

        return testResult;
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        logger.info('开始运行通信测试...');
        this.testResults = [];

        // 测试1: 连接状态
        const connectionTest = this.testConnection();
        this.testResults.push(connectionTest);

        // 如果未连接，提前返回
        if (connectionTest.issues.some(i => i.type === 'error')) {
            return this.testResults;
        }

        // 测试2: PDF 列表
        const listTest = await this.testPDFList();
        this.testResults.push(listTest);

        logger.info('通信测试完成', this.testResults);
        return this.testResults;
    }

    /**
     * 生成测试报告（HTML）
     */
    generateReport() {
        const errorCount = this.testResults.reduce(
            (sum, test) => sum + test.issues.filter(i => i.type === 'error').length, 0
        );
        const warningCount = this.testResults.reduce(
            (sum, test) => sum + test.issues.filter(i => i.type === 'warning').length, 0
        );

        let html = '<div class="test-report">';
        html += '<h3>通信测试报告</h3>';
        html += `<div class="summary">`;
        html += `<span class="test-count">共 ${this.testResults.length} 项测试</span>`;

        if (errorCount === 0 && warningCount === 0) {
            html += `<span class="status-success">✅ 全部通过</span>`;
        } else {
            if (errorCount > 0) {
                html += `<span class="status-error">❌ ${errorCount} 个错误</span>`;
            }
            if (warningCount > 0) {
                html += `<span class="status-warning">⚠️ ${warningCount} 个警告</span>`;
            }
        }
        html += '</div>';

        // 测试详情
        this.testResults.forEach(test => {
            html += `<div class="test-item">`;
            html += `<h4>${test.name}</h4>`;

            // 详细信息
            if (test.details && Object.keys(test.details).length > 0) {
                html += '<div class="test-details">';
                for (const [key, value] of Object.entries(test.details)) {
                    html += `<div><strong>${key}:</strong> ${value}</div>`;
                }
                html += '</div>';
            }

            // 问题列表
            if (test.issues.length > 0) {
                html += '<ul class="issue-list">';
                test.issues.forEach(issue => {
                    const icon = issue.type === 'error' ? '❌' : '⚠️';
                    html += `<li class="issue-${issue.type}">${icon} ${issue.message}</li>`;
                });
                html += '</ul>';
            } else {
                html += '<div class="no-issues">✅ 无问题</div>';
            }

            html += '</div>';
        });

        html += '</div>';
        return html;
    }
}

/**
 * 创建测试按钮和结果面板
 */
export function setupCommunicationTestUI(wsClient, eventBus) {
    const tester = new CommunicationTester(wsClient, eventBus);

    // 创建测试按钮
    const button = document.createElement('button');
    button.id = 'comm-test-btn';
    button.textContent = '🔍 通信测试';
    button.className = 'comm-test-button';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        z-index: 9999;
    `;

    // 创建结果面板
    const panel = document.createElement('div');
    panel.id = 'comm-test-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        width: 500px;
        max-height: 600px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        display: none;
        overflow-y: auto;
        z-index: 9998;
        padding: 15px;
    `;

    // 按钮点击事件
    button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = '⏳ 测试中...';
        panel.innerHTML = '<p>正在执行测试...</p>';
        panel.style.display = 'block';

        try {
            await tester.runAllTests();
            panel.innerHTML = tester.generateReport();
        } catch (error) {
            panel.innerHTML = `<div class="error">测试失败: ${error.message}</div>`;
        } finally {
            button.disabled = false;
            button.textContent = '🔍 通信测试';
        }
    });

    // 添加到页面
    document.body.appendChild(button);
    document.body.appendChild(panel);

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .test-report h3 { margin-top: 0; color: #333; }
        .test-report .summary {
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .test-report .status-success { color: #4CAF50; font-weight: bold; }
        .test-report .status-error { color: #f44336; font-weight: bold; }
        .test-report .status-warning { color: #ff9800; font-weight: bold; }
        .test-report .test-item {
            border-top: 1px solid #eee;
            padding-top: 10px;
            margin-top: 10px;
        }
        .test-report .test-item h4 { margin: 5px 0; color: #555; }
        .test-report .test-details {
            background: #f9f9f9;
            padding: 8px;
            border-radius: 3px;
            font-size: 12px;
            margin: 5px 0;
        }
        .test-report .issue-list {
            margin: 10px 0;
            padding-left: 20px;
        }
        .test-report .issue-error { color: #f44336; }
        .test-report .issue-warning { color: #ff9800; }
        .test-report .no-issues { color: #4CAF50; font-style: italic; }
    `;
    document.head.appendChild(style);

    logger.info('通信测试UI已设置');
}
