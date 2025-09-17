**规范名称**: 模块结构组织规范
**规范描述**: 定义application_subcode模块的文件组织、类结构、方法分组规则，确保模块具有良好的可扩展性和可维护性
**当前版本**: 1.0
**所属范畴**: 后端架构规范
**适用范围**: src/backend/app/application_subcode 目录下的所有Python文件結構

**详细内容**:
- 文件拆分原则：按照功能责任拆分文件，避免单一文件过长（不超过400行代码）
- 类组织规则：每个文件包含一个主要类，避免多个类混在一个文件中
- 方法分组：按功能将方法分组，使用注释分隔，如 `# 初始化方法`, `# 消息处理方法`
- 常量定义位置：模块级常量放在文件顶部，在类定义之前
- 导入顺序：标准库→第三方库→本地导入，按字母顺序组织
- 文件命名：使用snake_case命名文件，使用下划线分隔单词
- 配置管理：将硬编码参数转换为配置常量，集中管理配置项
- 文档规范：每个公有方法必须包含docstring，描述参数、返回类型和异常

**验证方法**:
- 使用行计数工具检查文件代码行数（目标：主文件<400行，辅助文件<200行）
- 检查每个文件中是否只有一个主要类定义
- 使用pylint检查导入顺序和分组
- 审查docstring覆盖率（目标：100%公有方法）
- 检查配置文件是否包含所有硬编码参数
- 运行模块测试验证拆分后接口兼容性

**正向例子**:
```python
# response_handlers.py 结构示例
"""
WebSocket响应处理工具
包含发送响应的各种工具函数
"""

import time  # 标准库按字母顺序
import logging
# 第三方库
from typing import Dict, Optional, Any
# 本地导入
from .constants import RESPONSE_CODES

# 模块级常量定义
DEFAULT_RESPONSE_CODE = 200
MAX_ERROR_MESSAGE_LENGTH = 500

# 响应错误码常量
RESPONSE_ERROR_CODES = {
    "MISSING_PARAMETERS": 400,
    "INVALID_FORMAT": 422,
    "PERMISSION_DENIED": 403
}

# ===== 接口定义 =====
class ResponseHandlers:
    """响应处理工具类

    提供统一的消息响应格式化、发送功能。
    """

    # ===== 初始化方法 =====
    def __init__(self, websocket_server):
        """响应处理器初始化

        Args:
            websocket_server: WebSocket服务器实例
        """
        self.websocket_server = websocket_server
        self.logger = logging.getLogger(__name__)

    # ===== 成功响应方法 =====
    def send_success_response(self, client, result, request_id=None):
        """发送成功响应消息

        Args:
            client: WebSocket客户端
            result: 响应结果数据
            request_id: 可选的请求ID

        Returns:
            bool: 发送是否成功
        """
        # 具体实现...

    # ===== 错误响应方法 =====
    def send_error_response(self, client, error_code, message, request_id=None):
        """发送错误响应消息

        Errors:
            InvalidErrorCodeError: 当error_code不在映射中时抛出

        Returns:
            bool: 发送是否成功
        """
        # 具体实现...
```

**反向例子**:
```python
# 错误示例：多类混在一个文件中
class Helpers:  # 类1
    pass

class Constants:  # 类2
    pass

class Utils:      # 类3
    pass

# 错误示例：乱序导入
import os
from typing import List
import sys
import logging
from pathlib import Path

# 错误示例：缺少docstring
def send_msg(client, data):  # 无文档说明
    pass

# 错误示例：硬编码常量散落在代码中
def process_request(init_data):
    timeout = 30  # 硬编码数字
    if init_data.get('format') == 'xml':  # 硬编码字符串
        # 处理逻辑
        pass
```

**规范要点**:
- 每个文件原则上只有一个主要类，加实用函数类例外
- 按照功能顺序组织方法，并在每组前添加注释分隔
- 严格按照导入顺序排列，按字母排序组织
- 所有公有方法必须有完整的docstring
- 硬编码参数必须移至模块级常量定义
- 保持文件总代码行数在合理范围内