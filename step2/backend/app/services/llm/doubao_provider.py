"""豆包 LLM 适配器。

职责：
- 将业务侧的结构化巡检结果转换为 LLM 可消费的提示词；
- 调用豆包接口生成自然语言总结与建议；
- 封装失败兜底，避免 LLM 异常影响主流程。
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings


class DoubaoProvider:
    """豆包 LLM 调用封装。"""

    def __init__(self) -> None:
        self.settings = get_settings()

    def enabled(self) -> bool:
        """是否启用豆包。"""
        return bool(self.settings.llm_use_doubao and self.settings.llm_doubao_api_key and self.settings.llm_doubao_model)

    def summarize_web_health_check(self, result: dict[str, Any]) -> dict[str, Any]:
        """基于巡检结果生成 LLM 总结。

        返回值统一为字典，便于与现有 JSON 结果合并。
        若调用失败，会返回包含 error 的兜底结果，不抛出异常。
        """
        if not self.enabled():
            return {"enabled": False, "summary": None, "error": None, "raw": None}

        prompt = self._build_prompt(result)
        payload = {
            "model": self.settings.llm_doubao_model,
            "messages": [
                {"role": "system", "content": "你是一个严谨的网页巡检分析助手，请根据结果给出简洁、专业、可执行的总结与建议。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }

        headers = {
            "Authorization": f"Bearer {self.settings.llm_doubao_api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=self.settings.llm_request_timeout_ms / 1000, verify=True) as client:
                resp = client.post(f"{self.settings.llm_doubao_base_url}/chat/completions", json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()

            content = data["choices"][0]["message"]["content"]
            return {"enabled": True, "summary": content, "error": None, "raw": data}
        except Exception as exc:  # noqa: BLE001
            return {"enabled": True, "summary": None, "error": str(exc)}

    @staticmethod
    def _build_prompt(result: dict[str, Any]) -> str:
        """把巡检结构化结果转成提示词。"""
        return (
            "请根据以下 Web Health Check 结果，输出：\n"
            "1. 一句话总体结论；\n"
            "2. 关键问题列表；\n"
            "3. 优先修复建议；\n\n"
            f"结果数据：\n{result}"
        )
