#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from pathlib import Path
import unittest


class TestGuiLauncherDist(unittest.TestCase):
    def setUp(self):
        # 延迟导入，避免 PyQt 环境干扰，仅测试纯函数
        import importlib
        self.mod = importlib.import_module('gui_launcher_dist')

    def test_dist_paths_exist(self):
        dl = self.mod.get_dist_latest_root()
        self.assertTrue(dl.exists(), f"dist/latest 根目录不存在: {dl}")

        paths = self.mod.get_launcher_paths()
        self.assertTrue(paths['backend'].exists(), f"后端 launcher 缺失: {paths['backend']}")
        self.assertTrue(paths['pdf_home'].exists(), f"pdf-home launcher 缺失: {paths['pdf_home']}")
        self.assertTrue(paths['pdf_viewer'].exists(), f"pdf-viewer launcher 缺失: {paths['pdf_viewer']}")

    def test_build_backend_cmd(self):
        from gui_launcher_dist import build_backend_cmd, get_launcher_paths
        backend = get_launcher_paths()['backend']
        cmd = build_backend_cmd(action='start')
        self.assertEqual(cmd[0], sys.executable)
        self.assertEqual(cmd[1:3], ['-X', 'utf8'])
        self.assertEqual(Path(cmd[3]), backend)
        self.assertEqual(cmd[4], 'start')

        cmd2 = build_backend_cmd(action='stop')
        self.assertEqual(cmd2[4], 'stop')

    def test_build_pdf_home_cmd(self):
        from gui_launcher_dist import build_pdf_home_cmd, get_launcher_paths
        pdf_home = get_launcher_paths()['pdf_home']
        cmd = build_pdf_home_cmd(prod=True, keep_backend=True)
        self.assertEqual(cmd[0], sys.executable)
        self.assertEqual(cmd[1:3], ['-X', 'utf8'])
        self.assertEqual(Path(cmd[3]), pdf_home)
        self.assertIn('--prod', cmd)
        self.assertIn('--keep-backend', cmd)

    def test_build_pdf_viewer_cmd(self):
        from gui_launcher_dist import build_pdf_viewer_cmd, get_launcher_paths
        pdf_viewer = get_launcher_paths()['pdf_viewer']
        cmd = build_pdf_viewer_cmd(pdf_id='sample', page_at=5, position=50.0, prod=True, keep_backend=True)
        self.assertEqual(cmd[0], sys.executable)
        self.assertEqual(cmd[1:3], ['-X', 'utf8'])
        self.assertEqual(Path(cmd[3]), pdf_viewer)
        self.assertIn('--prod', cmd)
        self.assertIn('--keep-backend', cmd)
        self.assertIn('--pdf-id', cmd)
        # 参数值基本校验
        self.assertEqual(cmd[cmd.index('--page-at') + 1], '5')
        self.assertEqual(cmd[cmd.index('--position') + 1], '50.0')


if __name__ == '__main__':
    unittest.main()

