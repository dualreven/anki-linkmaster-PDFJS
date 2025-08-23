# PDF处理规范

## 概述
本规范定义了项目中PDF文件处理的标准，包括文件验证、文本提取、图片处理、性能优化、错误处理等方面。确保PDF处理的可靠性、安全性和高效性。

## 文件验证规范

### 1. 文件格式验证
**要求**: 严格验证PDF文件格式，防止恶意文件

**验证流程**:
```python
class PdfValidator:
    """PDF文件验证器"""
    
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    SUPPORTED_VERSIONS = ['1.4', '1.5', '1.6', '1.7']
    
    @staticmethod
    def validate_pdf_file(file_path: str) -> Dict[str, Any]:
        """
        验证PDF文件有效性
        
        验证内容包括：
        1. 文件存在性和可读性
        2. 文件大小限制
        3. PDF文件头验证
        4. 版本兼容性检查
        5. 加密状态检测
        6. 结构完整性检查
        """
        result = {
            'valid': False,
            'error': None,
            'warnings': [],
            'metadata': {}
        }
        
        try:
            # 1. 基本文件检查
            if not os.path.exists(file_path):
                result['error'] = '文件不存在'
                return result
                
            if not os.access(file_path, os.R_OK):
                result['error'] = '文件不可读'
                return result
            
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                result['error'] = '文件为空'
                return result
                
            if file_size > PdfValidator.MAX_FILE_SIZE:
                result['error'] = f'文件过大，最大支持{PdfValidator.MAX_FILE_SIZE / (1024*1024):.0f}MB'
                return result
            
            # 2. PDF文件头验证
            with open(file_path, 'rb') as f:
                header = f.read(8)
                if not header.startswith(b'%PDF-'):
                    result['error'] = '无效的PDF文件格式'
                    return result
                
                # 提取版本号
                version = header[5:8].decode('ascii', errors='ignore')
                if version not in PdfValidator.SUPPORTED_VERSIONS:
                    result['warnings'].append(f'PDF版本{version}可能不兼容')
            
            # 3. 使用PyPDF2进行结构验证
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                
                # 检查加密
                if reader.is_encrypted:
                    result['warnings'].append('PDF文件已加密')
                
                # 检查页数
                if len(reader.pages) == 0:
                    result['error'] = 'PDF文件没有页面'
                    return result
                
                # 获取元数据
                if reader.metadata:
                    result['metadata'] = {
                        'title': reader.metadata.get('/Title', ''),
                        'author': reader.metadata.get('/Author', ''),
                        'subject': reader.metadata.get('/Subject', ''),
                        'creator': reader.metadata.get('/Creator', ''),
                        'creation_date': str(reader.metadata.get('/CreationDate', '')),
                        'modification_date': str(reader.metadata.get('/ModDate', ''))
                    }
            
            result['valid'] = True
            
        except PyPDF2.errors.PdfReadError as e:
            result['error'] = f'PDF文件损坏: {str(e)}'
        except Exception as e:
            result['error'] = f'验证失败: {str(e)}'
        
        return result
```

### 2. 安全检查
**要求**: 防止PDF炸弹和其他恶意PDF文件

**安全检查实现**:
```python
class PdfSecurityChecker:
    """PDF安全检查器"""
    
    @staticmethod
    def check_pdf_bomb(file_path: str) -> Dict[str, Any]:
        """
        检查PDF炸弹攻击
        
        PDF炸弹特征：
        1. 压缩比异常高（小文件解压后变得极大）
        2. 页面数量异常多
        3. 嵌套对象过深
        4. 重复引用的流对象
        """
        result = {
            'safe': True,
            'warnings': [],
            'details': {}
        }
        
        try:
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                
                # 检查压缩比
                file_size = os.path.getsize(file_path)
                uncompressed_size = 0
                
                for page_num, page in enumerate(reader.pages):
                    try:
                        # 尝试提取页面内容估算解压后大小
                        content = page.extract_text()
                        if content:
                            uncompressed_size += len(content.encode('utf-8'))
                    except:
                        pass
                
                # 如果解压后大小是文件大小的100倍以上，可能是炸弹
                if uncompressed_size > 0 and uncompressed_size / file_size > 100:
                    result['warnings'].append('异常高的压缩比，可能存在PDF炸弹风险')
                    result['details']['compression_ratio'] = uncompressed_size / file_size
                
                # 检查对象数量
                trailer = reader.trailer
                if '/Size' in trailer and trailer['/Size'] > 10000:
                    result['warnings'].append('对象数量异常多')
                    result['details']['object_count'] = trailer['/Size']
                
                # 检查页面数量
                page_count = len(reader.pages)
                if page_count > 1000:
                    result['warnings'].append(f'页面数量过多({page_count}页)')
                
        except Exception as e:
            result['safe'] = False
            result['warnings'].append(f'安全检查失败: {str(e)}')
        
        return result
```

## 文本提取规范

### 1. 文本提取策略
**要求**: 提供多种文本提取方式，确保准确性

**文本提取实现**:
```python
class PdfTextExtractor:
    """PDF文本提取器"""
    
    @staticmethod
    def extract_text_from_pdf(
        file_path: str,
        pages: Optional[List[int]] = None,
        method: str = 'auto'
    ) -> Dict[str, Any]:
        """
        从PDF提取文本内容
        
        支持多种提取方法：
        1. auto: 自动选择最佳方法
        2. pypdf2: 使用PyPDF2库
        3. pdfplumber: 使用pdfplumber库（更好的格式保持）
        4. tesseract: 使用OCR（扫描版PDF）
        
        Args:
            file_path: PDF文件路径
            pages: 指定页码，None表示所有页
            method: 提取方法
            
        Returns:
            包含文本和元数据的字典
        """
        result = {
            'text': '',
            'pages': [],
            'metadata': {},
            'method_used': method,
            'confidence': 0.0
        }
        
        try:
            if method == 'auto':
                method = PdfTextExtractor._determine_best_method(file_path)
            
            if method == 'pypdf2':
                result = PdfTextExtractor._extract_with_pypdf2(file_path, pages)
            elif method == 'pdfplumber':
                result = PdfTextExtractor._extract_with_pdfplumber(file_path, pages)
            elif method == 'tesseract':
                result = PdfTextExtractor._extract_with_ocr(file_path, pages)
            
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    @staticmethod
    def _determine_best_method(file_path: str) -> str:
        """确定最佳提取方法"""
        try:
            # 首先尝试PyPDF2
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                if len(reader.pages) > 0:
                    text = reader.pages[0].extract_text()
                    if text and len(text.strip()) > 10:
                        return 'pypdf2'
            
            # 尝试pdfplumber
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                if len(pdf.pages) > 0:
                    text = pdf.pages[0].extract_text()
                    if text and len(text.strip()) > 10:
                        return 'pdfplumber'
            
            # 最后使用OCR
            return 'tesseract'
            
        except Exception:
            return 'tesseract'
    
    @staticmethod
    def _extract_with_pypdf2(file_path: str, pages: Optional[List[int]] = None) -> Dict[str, Any]:
        """使用PyPDF2提取文本"""
        result = {'text': '', 'pages': []}
        
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            
            if pages is None:
                pages = range(len(reader.pages))
            
            for page_num in pages:
                if page_num < len(reader.pages):
                    page = reader.pages[page_num]
                    try:
                        text = page.extract_text()
                        if text:
                            result['pages'].append({
                                'page': page_num + 1,
                                'text': text.strip()
                            })
                            result['text'] += f"\n--- 第{page_num + 1}页 ---\n{text.strip()}\n"
                    except Exception as e:
                        result['pages'].append({
                            'page': page_num + 1,
                            'text': f'[提取失败: {str(e)}]'
                        })
        
        return result
```

### 2. OCR处理规范
**要求**: 为扫描版PDF提供OCR支持

**OCR实现**:
```python
class PdfOcrProcessor:
    """PDF OCR处理器"""
    
    @staticmethod
    def extract_text_with_ocr(
        file_path: str,
        pages: Optional[List[int]] = None,
        language: str = 'chi_sim+eng'
    ) -> Dict[str, Any]:
        """
        使用OCR提取扫描版PDF文本
        
        Args:
            file_path: PDF文件路径
            pages: 指定页码
            language: OCR语言设置
            
        Returns:
            OCR提取结果
        """
        result = {
            'text': '',
            'pages': [],
            'confidence': 0.0,
            'ocr_metadata': {}
        }
        
        try:
            import pytesseract
            from pdf2image import convert_from_path
            
            # 转换PDF页面为图片
            images = convert_from_path(
                file_path,
                dpi=300,
                first_page=min(pages) + 1 if pages else 1,
                last_page=max(pages) + 1 if pages else None
            )
            
            total_confidence = 0
            valid_pages = 0
            
            for i, image in enumerate(images):
                try:
                    # OCR文本提取
                    text = pytesseract.image_to_string(
                        image,
                        lang=language,
                        config='--psm 6'  # 假设是统一的文本块
                    )
                    
                    # 获取置信度
                    data = pytesseract.image_to_data(
                        image,
                        lang=language,
                        output_type=pytesseract.Output.DICT
                    )
                    
                    confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
                    page_confidence = sum(confidences) / len(confidences) if confidences else 0
                    
                    result['pages'].append({
                        'page': (pages[i] + 1) if pages else (i + 1),
                        'text': text.strip(),
                        'confidence': page_confidence,
                        'image_size': image.size
                    })
                    
                    if text.strip():
                        result['text'] += f"\n--- 第{result['pages'][-1]['page']}页 ---\n{text.strip()}\n"
                        total_confidence += page_confidence
                        valid_pages += 1
                        
                except Exception as e:
                    result['pages'].append({
                        'page': (pages[i] + 1) if pages else (i + 1),
                        'text': f'[OCR失败: {str(e)}]',
                        'confidence': 0
                    })
            
            result['confidence'] = total_confidence / valid_pages if valid_pages > 0 else 0
            result['ocr_metadata'] = {
                'total_pages': len(images),
                'ocr_engine': 'tesseract',
                'language': language,
                'dpi': 300
            }
            
        except ImportError as e:
            result['error'] = f'OCR依赖缺失: {str(e)}'
        except Exception as e:
            result['error'] = f'OCR处理失败: {str(e)}'
        
        return result
```

## 图片提取规范

### 1. 图片提取策略
**要求**: 支持提取PDF中的图片并保存为多种格式

**图片提取实现**:
```python
class PdfImageExtractor:
    """PDF图片提取器"""
    
    @staticmethod
    def extract_images(
        file_path: str,
        pages: Optional[List[int]] = None,
        output_dir: str = './extracted_images',
        formats: List[str] = ['png', 'jpg']
    ) -> Dict[str, Any]:
        """
        从PDF提取图片
        
        Args:
            file_path: PDF文件路径
            pages: 指定页码
            output_dir: 输出目录
            formats: 输出格式列表
            
        Returns:
            提取结果信息
        """
        result = {
            'total_images': 0,
            'extracted_images': [],
            'output_dir': output_dir,
            'formats': formats
        }
        
        try:
            import fitz  # PyMuPDF
            
            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)
            
            # 打开PDF
            doc = fitz.open(file_path)
            
            if pages is None:
                pages = range(len(doc))
            
            image_count = 0
            
            for page_num in pages:
                if page_num >= len(doc):
                    continue
                
                page = doc[page_num]
                
                # 获取页面图片列表
                image_list = page.get_images()
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        pix = fitz.Pixmap(doc, xref)
                        
                        # 处理CMYK颜色空间
                        if pix.colorspace and pix.colorspace.n == 4:
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        
                        # 保存为不同格式
                        for fmt in formats:
                            if fmt.lower() in ['png', 'jpg', 'jpeg']:
                                filename = f"page_{page_num + 1}_img_{img_index + 1}.{fmt}"
                                filepath = os.path.join(output_dir, filename)
                                
                                if fmt.lower() == 'png':
                                    pix.save(filepath)
                                else:
                                    pix.save(filepath, output='jpeg')
                                
                                result['extracted_images'].append({
                                    'page': page_num + 1,
                                    'index': img_index + 1,
                                    'filename': filename,
                                    'size': (pix.width, pix.height),
                                    'colorspace': str(pix.colorspace),
                                    'format': fmt
                                })
                                
                                image_count += 1
                        
                        pix = None
                        
                    except Exception as e:
                        result.setdefault('errors', []).append(
                            f"提取页面{page_num + 1}图片{img_index + 1}失败: {str(e)}"
                        )
            
            doc.close()
            result['total_images'] = image_count
            
        except ImportError:
            result['error'] = '缺少PyMuPDF库，请安装: pip install PyMuPDF'
        except Exception as e:
            result['error'] = f'图片提取失败: {str(e)}'
        
        return result
```

## 性能优化规范

### 1. 并发处理
**要求**: 支持多线程/多进程处理大量PDF文件

**并发处理实现**:
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from typing import List, Callable, Any

class PdfProcessor:
    """PDF批量处理器"""
    
    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
    
    async def process_multiple_pdfs(
        self,
        file_paths: List[str],
        processor_func: Callable,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        并发处理多个PDF文件
        
        Args:
            file_paths: PDF文件路径列表
            processor_func: 处理函数
            **kwargs: 处理参数
            
        Returns:
            处理结果列表
        """
        loop = asyncio.get_event_loop()
        
        # 创建异步任务
        tasks = [
            loop.run_in_executor(
                self.executor,
                processor_func,
                file_path,
                **kwargs
            )
            for file_path in file_paths
        ]
        
        # 等待所有任务完成
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理结果和异常
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    'file_path': file_paths[i],
                    'success': False,
                    'error': str(result)
                })
            else:
                result['file_path'] = file_paths[i]
                result['success'] = True
                processed_results.append(result)
        
        return processed_results
    
    def shutdown(self):
        """关闭线程池"""
        self.executor.shutdown(wait=True)
```

### 2. 缓存策略
**要求**: 实现智能缓存减少重复处理

**缓存实现**:
```python
import hashlib
import json
import os
from functools import lru_cache

class PdfCacheManager:
    """PDF处理缓存管理器"""
    
    def __init__(self, cache_dir: str = './cache'):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
    
    def get_cache_key(self, file_path: str, operation: str, **kwargs) -> str:
        """生成缓存键"""
        # 使用文件哈希和操作参数生成唯一键
        file_hash = self._get_file_hash(file_path)
        params_str = json.dumps(kwargs, sort_keys=True)
        combined = f"{file_hash}:{operation}:{params_str}"
        return hashlib.md5(combined.encode()).hexdigest()
    
    def _get_file_hash(self, file_path: str) -> str:
        """计算文件哈希"""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def get_cached_result(self, cache_key: str) -> Any:
        """获取缓存结果"""
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                os.remove(cache_file)
        return None
    
    def cache_result(self, cache_key: str, result: Any) -> None:
        """缓存结果"""
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"缓存失败: {e}")
    
    def cached_process(self, file_path: str, operation: str, processor_func: Callable, **kwargs):
        """带缓存的处理"""
        cache_key = self.get_cache_key(file_path, operation, **kwargs)
        
        # 检查缓存
        cached = self.get_cached_result(cache_key)
        if cached is not None:
            cached['cached'] = True
            return cached
        
        # 执行处理
        result = processor_func(file_path, **kwargs)
        
        # 缓存结果
        if result and 'error' not in result:
            self.cache_result(cache_key, result)
        
        result['cached'] = False
        return result
```

## 错误处理规范

### 1. 错误分类和处理
**要求**: 提供详细的错误分类和用户友好的错误信息

**错误处理实现**:
```python
class PdfProcessingError(Exception):
    """PDF处理基础异常"""
    pass

class PdfValidationError(PdfProcessingError):
    """PDF验证异常"""
    pass

class PdfExtractionError(PdfProcessingError):
    """PDF提取异常"""
    pass

class PdfSecurityError(PdfProcessingError):
    """PDF安全异常"""
    pass

class ErrorHandler:
    """PDF处理错误处理器"""
    
    ERROR_MESSAGES = {
        'FILE_NOT_FOUND': '文件不存在，请检查文件路径',
        'INVALID_FORMAT': '文件格式无效，请确保是有效的PDF文件',
        'FILE_TOO_LARGE': '文件过大，请选择小于50MB的文件',
        'ENCRYPTED_FILE': '文件已加密，请输入密码',
        'CORRUPTED_FILE': '文件已损坏，无法处理',
        'OCR_FAILED': 'OCR识别失败，可能是扫描质量问题',
        'MEMORY_ERROR': '内存不足，请尝试处理较小的文件',
        'TIMEOUT_ERROR': '处理超时，请稍后重试'
    }
    
    @staticmethod
    def handle_error(error: Exception, context: str = None) -> Dict[str, Any]:
        """统一错误处理"""
        error_info = {
            'error': True,
            'type': type(error).__name__,
            'message': str(error),
            'user_message': ErrorHandler.get_user_message(error),
            'context': context,
            'timestamp': datetime.now().isoformat()
        }
        
        # 记录错误日志
        logging.error(f"PDF处理错误 - {context}: {error}", exc_info=True)
        
        return error_info
    
    @staticmethod
    def get_user_message(error: Exception) -> str:
        """获取用户友好的错误消息"""
        error_type = type(error).__name__
        
        if 'FileNotFoundError' in str(type(error)):
            return ErrorHandler.ERROR_MESSAGES['FILE_NOT_FOUND']
        elif 'PdfReadError' in str(type(error)):
            return ErrorHandler.ERROR_MESSAGES['CORRUPTED_FILE']
        elif 'MemoryError' in str(type(error)):
            return ErrorHandler.ERROR_MESSAGES['MEMORY_ERROR']
        else:
            return str(error)
```

## 检查清单

在处理PDF文件时，请检查：

- [ ] 文件已进行格式验证和安全检查
- [ ] 文件大小在限制范围内（50MB）
- [ ] 文本提取方法已正确选择（自动/指定）
- [ ] OCR已针对扫描版PDF启用
- [ ] 图片提取支持多种格式输出
- [ ] 并发处理已正确配置线程池
- [ ] 缓存机制已启用避免重复处理
- [ ] 错误处理提供了用户友好的错误信息
- [ ] 性能监控已添加到处理流程
- [ ] 内存管理确保及时释放资源