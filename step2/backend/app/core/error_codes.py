"""统一错误码定义。

约定：
- 业务错误统一使用字符串错误码，便于前后端联调与国际化；
- 命名使用小写下划线风格；
- 由该模块统一维护，避免散落在各文件中的 magic string。
"""

TASK_NOT_FOUND = "task_not_found"
RUN_NOT_FOUND = "run_not_found"

# 可按需继续扩展：
# INVALID_TASK_PAYLOAD = "invalid_task_payload"
# RUN_ALREADY_FINISHED = "run_already_finished"
# TOOL_TIMEOUT = "tool_timeout"
