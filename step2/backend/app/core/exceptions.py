"""统一异常定义。

通过业务异常承载 error code，交由全局异常处理器统一转换为 ApiResponse。
"""

from dataclasses import dataclass


@dataclass
class AppException(Exception):
    """业务异常基类。"""

    code: str
    message: str
    status_code: int = 400
