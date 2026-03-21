"""统一日志配置：控制台 + 文件双输出。

用法：
    from utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("message")
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

_LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
_LOG_FILE = _LOG_DIR / "eval.log"
_CONFIGURED = False


def _ensure_dir() -> None:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)


def get_logger(name: str = "eval") -> logging.Logger:
    """获取或创建 logger，首次调用时配置 root handler。"""
    global _CONFIGURED

    logger = logging.getLogger(name)

    if not _CONFIGURED:
        # 从环境变量 / config 读取日志级别
        try:
            from config import LOG_LEVEL
            level_str = LOG_LEVEL
        except ImportError:
            level_str = os.getenv("LOG_LEVEL", "INFO")

        level = getattr(logging, level_str.upper(), logging.INFO)

        # root logger
        root = logging.getLogger()
        root.setLevel(level)

        fmt = logging.Formatter(
            "[%(asctime)s] %(levelname)-5s %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        # 控制台 handler（输出到 stdout，避免 PyCharm 标红）
        console = logging.StreamHandler(sys.stdout)
        console.setLevel(level)
        console.setFormatter(fmt)
        root.addHandler(console)

        # 文件 handler
        try:
            _ensure_dir()
            file_handler = logging.FileHandler(str(_LOG_FILE), encoding="utf-8")
            file_handler.setLevel(logging.DEBUG)  # 文件始终记录 DEBUG 级别
            file_handler.setFormatter(fmt)
            root.addHandler(file_handler)
        except OSError:
            # 无法写入文件时只用控制台
            pass

        _CONFIGURED = True

    return logger