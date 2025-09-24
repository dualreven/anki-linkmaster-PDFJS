#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog='ai-launcher', description='Modular AI Launcher')
    sub = p.add_subparsers(dest='cmd')

    sp = sub.add_parser('start', help='start a service')
    sp.add_argument('--name', required=True, help='service name')

    sp2 = sub.add_parser('stop', help='stop a service')
    sp2.add_argument('--name', required=True)

    sub.add_parser('status', help='list all service status')
    return p

