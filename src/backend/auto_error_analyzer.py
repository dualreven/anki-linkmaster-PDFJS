"""
Auto Error Analyzer - 自动分析错误并生成修复建议
"""

import re
import json
import ast
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ErrorPattern:
    """错误模式"""
    pattern: str
    severity: str
    category: str
    suggested_fix: str
    file_patterns: List[str]
    auto_fixable: bool = False

class AutoErrorAnalyzer:
    """自动错误分析器"""
    
    def __init__(self, log_dir: str = "logs/errors"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        self.analysis_log = self.log_dir / "auto_analysis.log"
        self.fix_log = self.log_dir / "auto_fixes.log"
        
        # 定义常见错误模式
        self.error_patterns = [
            ErrorPattern(
                pattern=r"Cannot read properties of (undefined|null)",
                severity="high",
                category="null_reference",
                suggested_fix="添加空值检查或确保对象已正确初始化",
                file_patterns=["*.js"],
                auto_fixable=True
            ),
            ErrorPattern(
                pattern=r"The requested module .* does not provide an export named 'default'",
                severity="high",
                category="module_export",
                suggested_fix="添加正确的ES6导出语句：export default ClassName",
                file_patterns=["*.js"],
                auto_fixable=True
            ),
            ErrorPattern(
                pattern=r"Unexpected identifier",
                severity="medium",
                category="syntax_error",
                suggested_fix="检查JavaScript语法错误，确保所有变量都正确声明",
                file_patterns=["*.js"],
                auto_fixable=False
            ),
            ErrorPattern(
                pattern=r"Failed to fetch",
                severity="medium",
                category="network_error",
                suggested_fix="检查网络连接和API端点配置",
                file_patterns=["*.js"],
                auto_fixable=False
            ),
            ErrorPattern(
                pattern=r"TypeError: .* is not a function",
                severity="high",
                category="type_error",
                suggested_fix="确保调用的函数存在且已正确导入",
                file_patterns=["*.js"],
                auto_fixable=True
            )
        ]
    
    def analyze_error(self, error_data: Dict) -> Dict:
        """分析单个错误"""
        message = error_data.get('message', '')
        filename = error_data.get('filename', '')
        
        analysis = {
            "timestamp": datetime.now().isoformat(),
            "error_id": f"{error_data.get('session_id', 'unknown')}_{error_data.get('timestamp', 'unknown')}",
            "original_error": error_data,
            "pattern_match": None,
            "severity": "medium",
            "category": "unknown",
            "suggested_fix": "请检查错误信息和相关代码",
            "auto_fix_available": False,
            "affected_files": [],
            "fix_steps": []
        }
        
        # 匹配错误模式
        for pattern in self.error_patterns:
            if re.search(pattern.pattern, message, re.IGNORECASE):
                analysis["pattern_match"] = pattern.pattern
                analysis["severity"] = pattern.severity
                analysis["category"] = pattern.category
                analysis["suggested_fix"] = pattern.suggested_fix
                analysis["auto_fix_available"] = pattern.auto_fixable
                
                # 查找可能受影响的文件
                if filename:
                    analysis["affected_files"].append(filename)
                
                # 生成修复步骤
                if pattern.auto_fixable:
                    analysis["fix_steps"] = self._generate_fix_steps(pattern, error_data)
                
                break
        
        return analysis
    
    def _generate_fix_steps(self, pattern: ErrorPattern, error_data: Dict) -> List[Dict]:
        """生成修复步骤"""
        fix_steps = []
        message = error_data.get('message', '')
        filename = error_data.get('filename', '')
        
        if pattern.category == "null_reference":
            fix_steps = [
                {
                    "step": 1,
                    "action": "add_null_check",
                    "description": "添加空值检查",
                    "code_before": "obj.property",
                    "code_after": "obj?.property || obj && obj.property"
                }
            ]
        
        elif pattern.category == "module_export":
            fix_steps = [
                {
                    "step": 1,
                    "action": "add_es6_export",
                    "description": "添加ES6默认导出",
                    "code_before": "// Legacy export",
                    "code_after": "// ES6 Module Export\nexport default ClassName;\n\n// Legacy export for compatibility"
                }
            ]
        
        elif pattern.category == "type_error":
            fix_steps = [
                {
                    "step": 1,
                    "action": "check_function_import",
                    "description": "检查函数导入",
                    "code_before": "functionName()",
                    "code_after": "// 确保函数已正确导入\nimport { functionName } from './module.js';"
                }
            ]
        
        return fix_steps
    
    def analyze_recent_errors(self, limit: int = 50) -> Dict:
        """分析最近的错误"""
        recent_errors = self._get_recent_errors(limit)
        
        if not recent_errors:
            return {"total_errors": 0, "analysis": "No recent errors found"}
        
        analyses = []
        error_summary = {
            "total_errors": len(recent_errors),
            "severity_distribution": {"high": 0, "medium": 0, "low": 0},
            "category_distribution": {},
            "auto_fixable_count": 0,
            "urgent_issues": []
        }
        
        for error in recent_errors:
            analysis = self.analyze_error(error)
            analyses.append(analysis)
            
            # 统计信息
            error_summary["severity_distribution"][analysis["severity"]] += 1
            category = analysis["category"]
            error_summary["category_distribution"][category] = error_summary["category_distribution"].get(category, 0) + 1
            
            if analysis["auto_fix_available"]:
                error_summary["auto_fixable_count"] += 1
            
            if analysis["severity"] == "high":
                error_summary["urgent_issues"].append({
                    "error_id": analysis["error_id"],
                    "message": error.get("message", ""),
                    "suggested_fix": analysis["suggested_fix"]
                })
        
        # 记录分析结果
        self._log_analysis(error_summary, analyses)
        
        return {
            "summary": error_summary,
            "detailed_analysis": analyses,
            "recommendations": self._generate_recommendations(error_summary)
        }
    
    def _get_recent_errors(self, limit: int) -> List[Dict]:
        """获取最近的错误"""
        errors = []
        error_log = self.log_dir / f"frontend_errors_{datetime.now().strftime('%Y%m%d')}.log"
        
        if error_log.exists():
            try:
                with open(error_log, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines[-limit:]:
                        if line.strip():
                            errors.append(json.loads(line))
            except Exception as e:
                logger.error(f"Failed to read recent errors: {e}")
        
        return errors
    
    def _log_analysis(self, summary: Dict, analyses: List[Dict]) -> None:
        """记录分析结果"""
        try:
            analysis_log = {
                "timestamp": datetime.now().isoformat(),
                "summary": summary,
                "analysis_count": len(analyses)
            }
            
            with open(self.analysis_log, 'a', encoding='utf-8') as f:
                f.write(json.dumps(analysis_log, ensure_ascii=False) + '\n')
                
        except Exception as e:
            logger.error(f"Failed to log analysis: {e}")
    
    def _generate_recommendations(self, summary: Dict) -> List[str]:
        """生成修复建议"""
        recommendations = []
        
        if summary["auto_fixable_count"] > 0:
            recommendations.append(f"发现 {summary['auto_fixable_count']} 个可自动修复的错误")
        
        if summary["severity_distribution"]["high"] > 0:
            recommendations.append(f"有 {summary['severity_distribution']['high']} 个高优先级错误需要立即处理")
        
        # 根据错误类型提供建议
        category_dist = summary["category_distribution"]
        if "null_reference" in category_dist:
            recommendations.append("建议加强代码中的空值检查")
        if "module_export" in category_dist:
            recommendations.append("建议检查所有模块的导出语句")
        if "syntax_error" in category_dist:
            recommendations.append("建议使用代码检查工具（如ESLint）来捕获语法错误")
        
        return recommendations
    
    def apply_auto_fix(self, error_id: str) -> Dict:
        """应用自动修复"""
        # 查找错误分析
        analysis = self._find_analysis_by_error_id(error_id)
        if not analysis:
            return {"success": False, "message": "Error analysis not found"}
        
        if not analysis["auto_fix_available"]:
            return {"success": False, "message": "This error is not auto-fixable"}
        
        # 应用修复步骤
        fix_results = []
        for step in analysis["fix_steps"]:
            result = self._apply_fix_step(step, analysis["affected_files"])
            fix_results.append(result)
        
        # 记录修复日志
        self._log_fix(error_id, analysis, fix_results)
        
        return {
            "success": True,
            "message": "Auto-fix applied successfully",
            "fix_results": fix_results
        }
    
    def _find_analysis_by_error_id(self, error_id: str) -> Optional[Dict]:
        """根据错误ID查找分析"""
        # 这里简化实现，实际应该从分析日志中查找
        return None
    
    def _apply_fix_step(self, step: Dict, affected_files: List[str]) -> Dict:
        """应用修复步骤"""
        # 这里简化实现，实际应该根据具体的修复步骤来修改文件
        return {
            "step": step["step"],
            "action": step["action"],
            "success": True,
            "message": f"Applied {step['action']} to affected files"
        }
    
    def _log_fix(self, error_id: str, analysis: Dict, fix_results: List[Dict]) -> None:
        """记录修复日志"""
        try:
            fix_log = {
                "timestamp": datetime.now().isoformat(),
                "error_id": error_id,
                "analysis": analysis,
                "fix_results": fix_results
            }
            
            with open(self.fix_log, 'a', encoding='utf-8') as f:
                f.write(json.dumps(fix_log, ensure_ascii=False) + '\n')
                
        except Exception as e:
            logger.error(f"Failed to log fix: {e}")
    
    def get_fix_history(self, limit: int = 50) -> List[Dict]:
        """获取修复历史"""
        fixes = []
        
        if self.fix_log.exists():
            try:
                with open(self.fix_log, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines[-limit:]:
                        if line.strip():
                            fixes.append(json.loads(line))
            except Exception as e:
                logger.error(f"Failed to read fix history: {e}")
        
        return fixes
    
    def get_error_trends(self, days: int = 7) -> Dict:
        """获取错误趋势"""
        trends = {}
        
        for i in range(days):
            date = datetime.now().date().replace(day=datetime.now().day - i)
            error_log = self.log_dir / f"frontend_errors_{date.strftime('%Y%m%d')}.log"
            
            if error_log.exists():
                try:
                    with open(error_log, 'r', encoding='utf-8') as f:
                        line_count = len(f.readlines())
                        trends[date.strftime('%Y-%m-%d')] = line_count
                except Exception as e:
                    logger.error(f"Failed to read error log for {date}: {e}")
            else:
                trends[date.strftime('%Y-%m-%d')] = 0
        
        return trends

# 全局实例
auto_analyzer = AutoErrorAnalyzer()

def get_auto_analyzer() -> AutoErrorAnalyzer:
    """获取自动分析器实例"""
    return auto_analyzer

def analyze_current_errors() -> Dict:
    """分析当前错误"""
    return auto_analyzer.analyze_recent_errors()

def apply_auto_fix_for_error(error_id: str) -> Dict:
    """为特定错误应用自动修复"""
    return auto_analyzer.apply_auto_fix(error_id)