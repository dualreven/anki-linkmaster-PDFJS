#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
端口管理器 - 动态端口分配和冲突检测
负责从runtime-ports.json读取端口配置，检测端口占用，自动分配可用端口
"""

import json
import socket
import time
from pathlib import Path
from typing import Dict, Optional, List, Tuple
import logging


class PortManager:
    """
    端口管理器 - 负责智能端口分配和配置管理
    """

    def __init__(self, project_root: Path):
        """
        初始化端口管理器

        Args:
            project_root: 项目根目录
        """
        self.project_root = project_root
        self.logs_dir = project_root / "logs"
        self.runtime_ports_file = self.logs_dir / "runtime-ports.json"

        # 确保logs目录存在
        self.logs_dir.mkdir(exist_ok=True)

        self.logger = logging.getLogger("ai-launcher.port-manager")

        # 默认端口配置
        self.default_ports = {
            "npm_port": 3000,
            "msgCenter_port": 8765,
            "pdfFile_port": 8080
        }

        # 端口搜索范围
        self.port_search_ranges = {
            "npm_port": (3000, 3100),    # NPM开发服务器端口范围
            "msgCenter_port": (8765, 8800),     # 消息中心服务器端口范围
            "pdfFile_port": (8080, 8120)     # PDF文件服务器端口范围
        }

    def is_port_available(self, port: int, host: str = "127.0.0.1") -> bool:
        """
        检查端口是否可用

        Args:
            port: 端口号
            host: 主机地址

        Returns:
            bool: 端口是否可用
        """
        try:
            # 创建socket并尝试绑定端口
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.settimeout(1.0)  # 1秒超时
                result = sock.connect_ex((host, port))
                # 如果连接失败(端口未被占用)，返回True
                return result != 0
        except Exception as e:
            self.logger.debug(f"Port availability check failed for {port}: {e}")
            # 出现异常时假设端口不可用
            return False

    def find_available_port(self, service_name: str, preferred_port: Optional[int] = None) -> int:
        """
        为指定服务查找可用端口

        Args:
            service_name: 服务名称 (npm_port, msgCenter_port, pdfFile_port)
            preferred_port: 首选端口号

        Returns:
            int: 可用的端口号

        Raises:
            RuntimeError: 如果在指定范围内找不到可用端口
        """
        # 确定搜索起点
        if preferred_port and self.is_port_available(preferred_port):
            self.logger.info(f"Preferred port {preferred_port} is available for {service_name}")
            return preferred_port

        # 获取搜索范围
        if service_name not in self.port_search_ranges:
            raise ValueError(f"Unknown service name: {service_name}")

        start_port, end_port = self.port_search_ranges[service_name]

        # 如果有首选端口，从首选端口开始搜索
        if preferred_port and start_port <= preferred_port <= end_port:
            search_start = preferred_port
        else:
            search_start = start_port

        # 搜索可用端口
        for port in range(search_start, end_port + 1):
            if self.is_port_available(port):
                self.logger.info(f"Found available port {port} for {service_name}")
                return port

        # 如果从首选端口开始没找到，从范围开始重新搜索
        if search_start != start_port:
            for port in range(start_port, search_start):
                if self.is_port_available(port):
                    self.logger.info(f"Found available port {port} for {service_name}")
                    return port

        # 没有找到可用端口
        raise RuntimeError(f"No available port found for {service_name} in range {start_port}-{end_port}")

    def load_runtime_ports(self) -> Dict[str, int]:
        """
        从runtime-ports.json加载端口配置

        Returns:
            Dict[str, int]: 端口配置字典
        """
        try:
            if self.runtime_ports_file.exists():
                with open(self.runtime_ports_file, 'r', encoding='utf-8') as f:
                    ports = json.load(f)

                # 验证配置完整性
                for key in self.default_ports:
                    if key not in ports:
                        self.logger.warning(f"Missing {key} in runtime-ports.json, using default")
                        ports[key] = self.default_ports[key]

                self.logger.info(f"Loaded runtime ports: {ports}")
                return ports
            else:
                self.logger.info("runtime-ports.json not found, using default ports")
                return self.default_ports.copy()

        except Exception as e:
            self.logger.error(f"Failed to load runtime-ports.json: {e}")
            self.logger.info("Using default ports")
            return self.default_ports.copy()

    def save_runtime_ports(self, ports: Dict[str, int]) -> bool:
        """
        保存端口配置到runtime-ports.json

        Args:
            ports: 端口配置字典

        Returns:
            bool: 保存是否成功
        """
        try:
            # 添加时间戳和元数据
            config = {
                **ports,
                "_metadata": {
                    "last_updated": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "updated_by": "ai-launcher-port-manager",
                    "version": "2.0"
                }
            }

            with open(self.runtime_ports_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            self.logger.info(f"Saved runtime ports: {ports}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to save runtime-ports.json: {e}")
            return False

    def allocate_ports(self, requested_ports: Optional[Dict[str, int]] = None) -> Dict[str, int]:
        """
        智能分配端口

        Args:
            requested_ports: 请求的端口配置 (可选)

        Returns:
            Dict[str, int]: 分配的端口配置
        """
        self.logger.info("Starting intelligent port allocation...")

        # 1. 加载现有配置
        current_ports = self.load_runtime_ports()

        # 2. 合并请求的端口
        if requested_ports:
            current_ports.update(requested_ports)
            self.logger.info(f"Merged requested ports: {requested_ports}")

        # 3. 检查和分配端口（只处理核心服务端口）
        allocated_ports = {}
        conflicts = []

        # 首先处理核心服务端口
        for service_name in self.default_ports.keys():
            preferred_port = current_ports.get(service_name, self.default_ports[service_name])

            try:
                if self.is_port_available(preferred_port):
                    allocated_ports[service_name] = preferred_port
                    self.logger.info(f"✓ {service_name}: {preferred_port} (available)")
                else:
                    conflicts.append((service_name, preferred_port))
                    new_port = self.find_available_port(service_name, preferred_port)
                    allocated_ports[service_name] = new_port
                    self.logger.warning(f"✗ {service_name}: {preferred_port} → {new_port} (conflict resolved)")

            except Exception as e:
                self.logger.error(f"Failed to allocate port for {service_name}: {e}")
                # 使用默认端口作为后备
                allocated_ports[service_name] = self.default_ports[service_name]

        # 保留非核心端口配置（如pdf-home-js），但不进行验证分配
        for service_name, port in current_ports.items():
            if service_name.startswith('_'):  # 跳过元数据
                continue
            if service_name not in self.default_ports:
                allocated_ports[service_name] = port  # 直接保留，不验证

        # 4. 保存更新的配置
        if conflicts or requested_ports:
            self.save_runtime_ports(allocated_ports)

        # 5. 输出分配结果
        self.logger.info("Port allocation completed:")
        for service_name, port in allocated_ports.items():
            self.logger.info(f"  {service_name}: {port}")

        if conflicts:
            self.logger.info(f"Resolved {len(conflicts)} port conflicts")

        return allocated_ports

    def validate_port_allocation(self, ports: Dict[str, int]) -> Tuple[bool, List[str]]:
        """
        验证端口分配是否有效

        Args:
            ports: 端口配置

        Returns:
            Tuple[bool, List[str]]: (是否有效, 错误信息列表)
        """
        errors = []
        used_ports = set()

        # 只验证核心服务端口
        for service_name, port in ports.items():
            if service_name.startswith('_'):  # 跳过元数据
                continue
            if service_name not in self.default_ports:  # 跳过非核心端口
                continue

            # 检查端口范围
            if not (1024 <= port <= 65535):
                errors.append(f"{service_name} port {port} is out of valid range (1024-65535)")

            # 检查端口重复（只在核心服务间检查）
            if port in used_ports:
                errors.append(f"Port {port} is assigned to multiple services")
            used_ports.add(port)

            # 检查端口可用性
            if not self.is_port_available(port):
                errors.append(f"{service_name} port {port} is not available")

        return len(errors) == 0, errors

    def get_service_ports(self) -> Dict[str, int]:
        """
        获取当前有效的服务端口配置

        Returns:
            Dict[str, int]: 服务端口配置
        """
        return self.allocate_ports()

    def release_ports(self, service_names: Optional[List[str]] = None) -> bool:
        """
        释放指定服务的端口（从配置中移除）

        Args:
            service_names: 要释放的服务名称列表，None表示释放所有

        Returns:
            bool: 释放是否成功
        """
        try:
            if service_names is None:
                # 释放所有端口，重置为默认配置
                return self.save_runtime_ports(self.default_ports.copy())
            else:
                # 释放指定服务的端口
                current_ports = self.load_runtime_ports()
                for service_name in service_names:
                    if service_name in current_ports:
                        current_ports[service_name] = self.default_ports.get(service_name, 8000)
                        self.logger.info(f"Released port for {service_name}")

                return self.save_runtime_ports(current_ports)

        except Exception as e:
            self.logger.error(f"Failed to release ports: {e}")
            return False