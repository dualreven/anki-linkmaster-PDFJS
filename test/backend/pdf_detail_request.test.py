"""
PDF_DETAIL_REQUEST消息处理功能测试
测试后端PDF_DETAIL_REQUEST消息的正确处理，包括消息解析、错误处理和响应生成。
"""
import pytest
import json
import os
import sys
from unittest.mock import Mock, MagicMock, patch

# 添加src目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src'))

from backend.app.application import AnkiLinkMasterApp
from backend.pdf_manager.manager import PDFManager
from backend.pdf_manager.models import PDFFile, PDFFileList


class TestPDFDetailRequest:
    """PDF_DETAIL_REQUEST消息处理测试类"""
    
    @pytest.fixture
    def app(self):
        """创建测试应用实例"""
        app = AnkiLinkMasterApp()
        app.pdf_manager = Mock(spec=PDFManager)
        app.websocket_server = Mock()
        return app
    
    @pytest.fixture
    def mock_client(self):
        """创建模拟WebSocket客户端"""
        client = Mock()
        client.peerPort.return_value = 12345
        return client
    
    def test_message_parsing_valid_request(self, app, mock_client):
        """测试消息解析功能 - 有效的请求"""
        # 准备测试数据
        valid_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': 'test_file_123'
            }
        }
        
        # 模拟PDF管理器返回文件详情
        mock_file_detail = {
            'id': 'test_file_123',
            'filename': 'test.pdf',
            'title': 'Test Document',
            'page_count': 10,
            'size': 1024
        }
        app.pdf_manager.get_file_detail.return_value = mock_file_detail
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, valid_message)
        
        # 验证消息被正确解析和处理
        app.pdf_manager.get_file_detail.assert_called_once_with('test_file_123')
        app.send_success_response.assert_called_once_with(
            mock_client, 'pdf_detail_request', mock_file_detail, 'req_test_123'
        )
    
    def test_message_parsing_missing_file_id(self, app, mock_client):
        """测试消息解析功能 - 缺少file_id参数"""
        invalid_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {}  # 缺少file_id
        }
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, invalid_message)
        
        # 验证发送了错误响应
        app.send_error_response.assert_called_once()
        call_args = app.send_error_response.call_args[0]
        assert call_args[0] == mock_client
        assert "缺少文件ID参数" in call_args[1]
        assert call_args[2] == "pdf_detail_request"
        assert call_args[3] == "MISSING_PARAMETERS"
        assert call_args[4] == "req_test_123"
    
    def test_message_parsing_invalid_format(self, app, mock_client):
        """测试消息解析功能 - 无效的消息格式"""
        invalid_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123'
            # 缺少data字段
        }
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, invalid_message)
        
        # 验证发送了错误响应
        app.send_error_response.assert_called_once()
        call_args = app.send_error_response.call_args[0]
        assert "参数格式错误" in call_args[1]
    
    def test_error_handling_file_not_found(self, app, mock_client):
        """测试错误处理功能 - 文件不存在"""
        valid_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': 'non_existent_file'
            }
        }
        
        # 模拟PDF管理器返回None（文件不存在）
        app.pdf_manager.get_file_detail.return_value = None
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, valid_message)
        
        # 验证发送了文件未找到错误
        app.send_error_response.assert_called_once_with(
            mock_client, "未找到文件: non_existent_file", 
            "pdf_detail_request", "FILE_NOT_FOUND", "req_test_123"
        )
    
    def test_error_handling_pdf_manager_exception(self, app, mock_client):
        """测试错误处理功能 - PDF管理器抛出异常"""
        valid_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': 'test_file_123'
            }
        }
        
        # 模拟PDF管理器抛出异常
        app.pdf_manager.get_file_detail.side_effect = Exception("Database error")
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, valid_message)
        
        # 验证发送了内部错误响应
        app.send_error_response.assert_called_once()
        call_args = app.send_error_response.call_args[0]
        assert "处理PDF详情请求时出错" in call_args[1]
        assert call_args[3] == "INTERNAL_ERROR"
    
    def test_response_generation_success(self, app, mock_client):
        """测试响应生成功能 - 成功响应"""
        valid_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': 'test_file_123'
            }
        }
        
        # 模拟PDF管理器返回详细的文件信息
        detailed_file_info = {
            'id': 'test_file_123',
            'filename': 'test.pdf',
            'title': 'Test Document',
            'author': 'Test Author',
            'page_count': 15,
            'size': 2048,
            'tags': ['test', 'document'],
            'upload_time': 1693478400,
            'metadata': {
                'creator': 'Test Creator',
                'producer': 'Test Producer',
                'creation_date': '2023-01-01'
            },
            'stats': {
                'size': 2048,
                'created_at': 1693478400000,
                'modified_at': 1693478400000,
                'accessed_at': 1693478400000
            },
            'original_path': '/path/to/original/test.pdf'
        }
        app.pdf_manager.get_file_detail.return_value = detailed_file_info
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, valid_message)
        
        # 验证成功响应包含完整的数据
        app.send_success_response.assert_called_once_with(
            mock_client, 'pdf_detail_request', detailed_file_info, 'req_test_123'
        )
    
    def test_response_generation_partial_data(self, app, mock_client):
        """测试响应生成功能 - 部分数据"""
        valid_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': 'test_file_123'
            }
        }
        
        # 模拟PDF管理器返回部分数据
        partial_file_info = {
            'id': 'test_file_123',
            'filename': 'test.pdf',
            'page_count': 10,
            'size': 1024
        }
        app.pdf_manager.get_file_detail.return_value = partial_file_info
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, valid_message)
        
        # 验证成功响应包含可用数据
        app.send_success_response.assert_called_once_with(
            mock_client, 'pdf_detail_request', partial_file_info, 'req_test_123'
        )
    
    def test_performance_multiple_requests(self, app, mock_client):
        """测试性能 - 处理多个并发请求"""
        requests = []
        for i in range(10):
            request = {
                'type': 'pdf_detail_request',
                'request_id': f'req_test_{i}',
                'data': {
                    'file_id': f'test_file_{i}'
                }
            }
            requests.append(request)
        
        # 模拟PDF管理器返回不同的文件详情
        def mock_get_file_detail(file_id):
            return {
                'id': file_id,
                'filename': f'test_{file_id}.pdf',
                'page_count': 10 + int(file_id.split('_')[-1]),
                'size': 1024
            }
        app.pdf_manager.get_file_detail.side_effect = mock_get_file_detail
        
        # 处理所有请求
        for request in requests:
            app.handle_pdf_detail_request(mock_client, request)
        
        # 验证所有请求都被处理
        assert app.pdf_manager.get_file_detail.call_count == 10
        assert app.send_success_response.call_count == 10
    
    def test_boundary_case_empty_file_id(self, app, mock_client):
        """测试边界情况 - 空文件ID"""
        message_with_empty_id = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': ''
            }
        }
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, message_with_empty_id)
        
        # 验证发送了错误响应
        app.send_error_response.assert_called_once()
        call_args = app.send_error_response.call_args[0]
        assert "缺少文件ID参数" in call_args[1]
    
    def test_boundary_case_long_file_id(self, app, mock_client):
        """测试边界情况 - 超长文件ID"""
        long_file_id = 'a' * 1000  # 1000个字符的文件ID
        message_with_long_id = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': long_file_id
            }
        }
        
        # 模拟PDF管理器处理长ID
        app.pdf_manager.get_file_detail.return_value = None
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, message_with_long_id)
        
        # 验证能够正确处理长ID
        app.pdf_manager.get_file_detail.assert_called_once_with(long_file_id)
    
    def test_boundary_case_special_characters_file_id(self, app, mock_client):
        """测试边界情况 - 特殊字符文件ID"""
        special_file_id = 'test_file_123!@#$%^&*()_+-=[]{}|;:,.<>?'
        message_with_special_id = {
            'type': 'pdf_detail_request',
            'request_id': 'req_test_123',
            'data': {
                'file_id': special_file_id
            }
        }
        
        # 模拟PDF管理器处理特殊字符ID
        app.pdf_manager.get_file_detail.return_value = {
            'id': special_file_id,
            'filename': 'special.pdf',
            'page_count': 10,
            'size': 1024
        }
        
        # 调用处理方法
        app.handle_pdf_detail_request(mock_client, message_with_special_id)
        
        # 验证能够正确处理特殊字符ID
        app.pdf_manager.get_file_detail.assert_called_once_with(special_file_id)
        app.send_success_response.assert_called_once()
    
    def test_integration_full_workflow(self, app, mock_client):
        """测试集成测试 - 完整工作流程"""
        # 准备测试数据
        test_message = {
            'type': 'pdf_detail_request',
            'request_id': 'req_integration_test',
            'data': {
                'file_id': 'integration_test_file'
            }
        }
        
        # 模拟完整的文件详情数据
        full_file_detail = {
            'id': 'integration_test_file',
            'filename': 'integration_test.pdf',
            'title': 'Integration Test Document',
            'author': 'Test Author',
            'page_count': 20,
            'size': 4096,
            'tags': ['integration', 'test'],
            'upload_time': 1693478400,
            'metadata': {
                'creator': 'Test Creator',
                'producer': 'Test Producer',
                'creation_date': '2023-01-01',
                'modification_date': '2023-01-02'
            },
            'stats': {
                'size': 4096,
                'created_at': 1693478400000,
                'modified_at': 1693478400000,
                'accessed_at': 1693478400000
            },
            'original_path': '/path/to/integration_test.pdf'
        }
        app.pdf_manager.get_file_detail.return_value = full_file_detail
        
        # 执行完整的处理流程
        app.handle_pdf_detail_request(mock_client, test_message)
        
        # 验证完整的集成流程
        app.pdf_manager.get_file_detail.assert_called_once_with('integration_test_file')
        app.send_success_response.assert_called_once_with(
            mock_client, 'pdf_detail_request', full_file_detail, 'req_integration_test'
        )
        
        # 验证响应数据完整性
        call_args = app.send_success_response.call_args[0]
        response_data = call_args[2]
        assert response_data['id'] == 'integration_test_file'
        assert response_data['filename'] == 'integration_test.pdf'
        assert response_data['page_count'] == 20
        assert response_data['size'] == 4096
        assert 'metadata' in response_data
        assert 'stats' in response_data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])