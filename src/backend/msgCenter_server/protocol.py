"""
WebSocket协议处理工具模块
"""
import json
import struct
import logging

logger = logging.getLogger(__name__)

class WebSocketProtocol:
    """WebSocket协议处理工具类"""
    
    @staticmethod
    def parse_frame(data):
        """
        解析WebSocket数据帧
        
        Args:
            data: 原始字节数据
            
        Returns:
            dict: 解析结果，包含opcode、payload等
        """
        if len(data) < 2:
            return None
            
        first_byte = data[0]
        second_byte = data[1]
        
        # 提取FIN位和opcode
        fin = (first_byte & 0x80) != 0
        opcode = first_byte & 0x0F
        
        # 提取掩码标志和负载长度
        masked = (second_byte & 0x80) != 0
        payload_len = second_byte & 0x7F
        
        header_len = 2
        
        # 扩展负载长度
        if payload_len == 126:
            if len(data) < 4:
                return None
            payload_len = struct.unpack('>H', data[2:4])[0]
            header_len = 4
        elif payload_len == 127:
            if len(data) < 10:
                return None
            payload_len = struct.unpack('>Q', data[2:10])[0]
            header_len = 10
        
        # 检查是否有完整的帧
        if len(data) < header_len + (4 if masked else 0) + payload_len:
            return None
        
        # 提取负载
        payload_start = header_len + (4 if masked else 0)
        payload = data[payload_start:payload_start + payload_len]
        
        # 解码掩码负载
        if masked:
            mask = data[header_len:header_len + 4]
            payload = bytes([payload[i] ^ mask[i % 4] for i in range(len(payload))])
        
        return {
            'fin': fin,
            'opcode': opcode,
            'masked': masked,
            'payload': payload,
            'length': len(payload)
        }
    
    @staticmethod
    def build_frame(payload, opcode=0x1, masked=False):
        """
        构建WebSocket数据帧
        
        Args:
            payload: 负载数据（bytes或str）
            opcode: 操作码（默认0x1文本帧）
            masked: 是否使用掩码
            
        Returns:
            bytes: 完整的WebSocket帧
        """
        if isinstance(payload, str):
            payload = payload.encode('utf-8')
        
        length = len(payload)
        
        # 构建帧头
        frame = struct.pack('B', 0x80 | opcode)  # FIN + opcode
        
        # 负载长度编码
        if length < 126:
            length_byte = length
            frame += struct.pack('B', length_byte | (0x80 if masked else 0))
        elif length < 65536:
            frame += struct.pack('B', 126 | (0x80 if masked else 0))
            frame += struct.pack('>H', length)
        else:
            frame += struct.pack('B', 127 | (0x80 if masked else 0))
            frame += struct.pack('>Q', length)
        
        # 掩码（客户端到服务器需要掩码）
        if masked:
            mask_key = struct.pack('>I', 0x12345678)  # 应该使用随机数
            frame += mask_key
            payload = bytes([payload[i] ^ mask_key[i % 4] for i in range(len(payload))])
        
        frame += payload
        return frame
    
    @staticmethod
    def build_text_frame(text, masked=False):
        """构建文本帧"""
        return WebSocketProtocol.build_frame(text, 0x1, masked)
    
    @staticmethod
    def build_binary_frame(data, masked=False):
        """构建二进制帧"""
        return WebSocketProtocol.build_frame(data, 0x2, masked)
    
    @staticmethod
    def build_close_frame(reason="", masked=False):
        """构建关闭帧"""
        return WebSocketProtocol.build_frame(reason, 0x8, masked)
    
    @staticmethod
    def build_ping_frame(data="", masked=False):
        """构建ping帧"""
        return WebSocketProtocol.build_frame(data, 0x9, masked)
    
    @staticmethod
    def build_pong_frame(data="", masked=False):
        """构建pong帧"""
        return WebSocketProtocol.build_frame(data, 0xA, masked)

class MessageHandler:
    """消息处理工具类"""
    
    @staticmethod
    def parse_message(raw_message):
        """
        解析JSON消息
        
        Args:
            raw_message: 原始消息字符串
            
        Returns:
            dict: 解析后的消息对象
        """
        try:
            return json.loads(raw_message)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message: {e}")
            return None
    
    @staticmethod
    def build_message(message_type, data=None, **kwargs):
        """
        构建标准消息格式
        
        Args:
            message_type: 消息类型
            data: 消息数据
            **kwargs: 其他消息字段
            
        Returns:
            str: JSON格式的消息字符串
        """
        message = {
            'type': message_type,
            'timestamp': __import__('time').time(),
            'data': data or {}
        }
        message.update(kwargs)
        return json.dumps(message)
    
    @staticmethod
    def build_error_message(error_code, error_message, **kwargs):
        """构建错误消息"""
        return MessageHandler.build_message(
            'error',
            error_code=error_code,
            error_message=error_message,
            **kwargs
        )
    
    @staticmethod
    def build_success_message(data=None, **kwargs):
        """构建成功消息"""
        return MessageHandler.build_message('success', data, **kwargs)