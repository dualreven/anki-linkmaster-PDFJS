import asyncio
import argparse
import json
import logging
from datetime import datetime

import aiohttp
import websockets

# --- 配置 ---
DEFAULT_DEBUG_PORT = 9222

def get_log_file(port):
    """根据端口生成日志文件名"""
    return f'debug-console-at-{port}.log'
# --- 配置结束 ---

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='浏览器调试控制台监听工具')
    parser.add_argument('--port', '-p', type=int, default=DEFAULT_DEBUG_PORT,
                        help=f'调试端口 (默认: {DEFAULT_DEBUG_PORT})')
    return parser.parse_args()

# 设置基础日志记录，用于记录本程序自身的状态
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def clear_log_file(port):
    """清空并初始化日志文件"""
    log_file = get_log_file(port)
    try:
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"--- Log Cleared and Initialized at {datetime.now().isoformat()} ---\n")
            f.write("--- Waiting for new console messages... ---\n\n")
        logging.info(f"Log file '{log_file}' has been cleared.")
    except IOError as e:
        logging.error(f"Failed to clear log file '{log_file}': {e}")

def append_to_log(message: str, port):
    """向日志文件追加内容"""
    log_file = get_log_file(port)
    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(message + '\n')
    except IOError as e:
        logging.error(f"Failed to write to log file '{log_file}': {e}")

def format_console_message(params: dict) -> str:
    """
    格式化 consoleAPICalled 事件的参数
    """
    log_type = params.get('type', 'log').upper()
    timestamp = datetime.fromtimestamp(params['timestamp'] / 1000).strftime('%H:%M:%S.%f')[:-3]
    
    args = params.get('args', [])
    message_parts = []
    for arg in args:
        if 'value' in arg:
            message_parts.append(str(arg['value']))
        elif 'description' in arg:
            message_parts.append(arg['description'])
        else:
            message_parts.append('[Complex Object]')

    full_message = ' '.join(message_parts)
    return f"[{timestamp}][{log_type}] {full_message}"

def format_exception_message(params: dict) -> str:
    """
    格式化 exceptionThrown 事件的参数
    """
    timestamp = datetime.fromtimestamp(params['timestamp'] / 1000).strftime('%H:%M:%S.%f')[:-3]
    exception_details = params.get('exceptionDetails', {})
    text = exception_details.get('text', 'No exception text.')
    exception = exception_details.get('exception', {})
    description = exception.get('description', 'No description.').split('\n')[0] # 取第一行核心信息

    return f"[{timestamp}][FATAL ERROR] {text}\n  > {description}"

def format_loading_failed_message(params: dict) -> str:
    """
    格式化 Network.loadingFailed 事件的参数
    """
    timestamp = datetime.fromtimestamp(params['timestamp'] / 1000).strftime('%H:%M:%S.%f')[:-3]
    request_id = params.get('requestId', 'unknown')
    error_text = params.get('errorText', 'Unknown error')
    request_url = params.get('request', {}).get('url', 'Unknown URL')
    
    return f"[{timestamp}][LOAD FAILED] {error_text}\n  > URL: {request_url}"

def format_response_received_message(params: dict) -> str:
    """
    格式化 Network.responseReceived 事件的参数，用于捕捉4xx和5xx错误
    """
    timestamp = datetime.fromtimestamp(params['timestamp'] / 1000).strftime('%H:%M:%S.%f')[:-3]
    response = params.get('response', {})
    status = response.get('status', 0)
    status_text = response.get('statusText', '')
    url = response.get('url', 'Unknown URL')
    
    # 只记录4xx和5xx错误
    if 400 <= status < 600:
        return f"[{timestamp}][HTTP ERROR] {status} {status_text}\n  > URL: {url}"
    
    return None

async def listen_to_browser(port):
    """
    主函数，连接到浏览器并监听事件
    """
    # 1. 获取 WebSocket 调试 URL
    target_url = f"http://localhost:{port}/json"
    logging.info(f"Attempting to connect to {target_url} to find a debuggable page.")
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(target_url) as response:
                if response.status != 200:
                    logging.error(f"Failed to get target list: HTTP {response.status}")
                    return
                targets = await response.json()
        except aiohttp.ClientConnectorError:
            error_msg = f"Connection to {target_url} failed. Is the Qt application with remote debugging running?"
            logging.error(error_msg)
            # 即使连接失败也创建日志文件并记录错误信息
            clear_log_file(port)
            append_to_log(f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}][ERROR] {error_msg}", port)
            return

    # 寻找第一个类型为 "page" 的目标
    page_target = next((t for t in targets if t.get('type') == 'page'), None)
    if not page_target or 'webSocketDebuggerUrl' not in page_target:
        logging.warning("No debuggable page found. Waiting for a page to become available.")
        return

    ws_url = page_target['webSocketDebuggerUrl']
    logging.info(f"Found debuggable page. Connecting to WebSocket at {ws_url}")

    # 2. 连接 WebSocket 并处理事件
    try:
        async with websockets.connect(ws_url, max_size=None) as websocket:
            # 启用需要的 CDP 域
            await websocket.send(json.dumps({"id": 1, "method": "Page.enable"}))
            await websocket.send(json.dumps({"id": 2, "method": "Runtime.enable"}))
            await websocket.send(json.dumps({"id": 3, "method": "Network.enable"}))
            logging.info("Successfully enabled Page, Runtime, and Network domains. Listening for events...")
            
            # 初始时清空一次日志
            clear_log_file(port)

            # 3. 循环监听消息
            async for message in websocket:
                data = json.loads(message)
                
                # 检查消息是否是一个事件 (有 'method' 字段)
                if 'method' in data:
                    method = data['method']
                    params = data.get('params', {})

                    # --- 功能 2: 页面重载后清空日志 ---
                    if method == 'Page.frameNavigated':
                        # 只有主框架的导航才触发清空
                        if params.get('frame', {}).get('parentId') is None:
                            logging.info("Main frame navigated (Vite Hot Reload detected). Clearing log file.")
                            clear_log_file(port)

                    # --- 功能 1: 监听 console 信息 ---
                    elif method == 'Runtime.consoleAPICalled':
                        log_entry = format_console_message(params)
                        print(log_entry) # 也在终端打印一份
                        append_to_log(log_entry, port)

                    # --- 功能 3: 监听严重错误 ---
                    elif method == "Runtime.exceptionThrown":
                        error_entry = format_exception_message(params)
                        print(error_entry) # 也在终端打印一份
                        append_to_log(error_entry, port)

                    # --- 功能 4: 监听网络加载失败 ---
                    elif method == "Network.loadingFailed":
                        error_entry = format_loading_failed_message(params)
                        print(error_entry) # 也在终端打印一份
                        append_to_log(error_entry, port)

                    # --- 功能 5: 监听HTTP错误响应 ---
                    elif method == "Network.responseReceived":
                        error_entry = format_response_received_message(params)
                        if error_entry:  # 只记录4xx和5xx错误
                            print(error_entry) # 也在终端打印一份
                            append_to_log(error_entry, port)

    except websockets.exceptions.ConnectionClosed as e:
        logging.warning(f"WebSocket connection closed: {e}. Will try to reconnect.")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")


async def main():
    """
    程序入口，包含重连逻辑
    """
    args = parse_args()
    while True:
        await listen_to_browser(args.port)
        logging.info("Disconnected. Reconnecting in 5 seconds...")
        await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        args = parse_args()
        logging.info(f"Starting debug console listener on port {args.port}")
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Program terminated by user.")