from __future__ import annotations

import json
from typing import List, Optional

try:
    from openai import OpenAI  # type: ignore
except ImportError:
    OpenAI = None  # type: ignore

from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from utils.logger import get_logger
from .base import Metric, MetricResult

logger = get_logger("metrics.task_completion")


class TaskCompletion(Metric):
    name = "task_completion"

    def __init__(self, keywords: List[str] | None = None, use_llm: bool = True) -> None:
        self.keywords = keywords or ["查询", "下单", "支付", "订单号"]
        self.use_llm = use_llm

    def _rule_score(self, final_answer: str) -> MetricResult:
        matched = sum(1 for k in self.keywords if k in final_answer)
        score = matched / len(self.keywords) if self.keywords else 0.0
        return MetricResult(value=score, reason="任务完成度(规则版)", traces={"matched": matched})

    def _call_llm(self, prompt: str, task_id: str = "") -> Optional[str]:
        api_key = LLM_API_KEY
        model = LLM_MODEL
        if not api_key:
            logger.warning("task_id=%s | 缺少 LLM_API_KEY，请在 .env 中配置", task_id)
            return None
        if OpenAI is None:
            logger.warning("task_id=%s | 未安装 openai 包，请 pip install openai", task_id)
            return None

        logger.info("task_id=%s | 发送 LLM 请求，model=%s", task_id, model)
        logger.debug("task_id=%s | LLM prompt:\n%s", task_id, prompt)

        try:
            client_kwargs = {"api_key": api_key, "timeout": 30, "max_retries": 1}
            if LLM_BASE_URL:
                client_kwargs["base_url"] = LLM_BASE_URL
            client = OpenAI(**client_kwargs)
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是严格的评测助手，只输出 JSON。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
            )
            content = response.choices[0].message.content
            logger.debug("task_id=%s | LLM raw response:\n%s", task_id, content)
            return content
        except Exception as exc:
            logger.error("task_id=%s | LLM 调用异常: %s", task_id, exc)
            return None

    def _llm_score(self, sample) -> MetricResult:
        task_id = getattr(sample, "task_id", "?")
        prompt = (
            "你是严格的评测助手，请判断任务是否完成，并指出缺失要素。\n"
            "判断规则：必须同时满足期望结果中的核心要素（如查询店铺/菜品、下单、支付、订单号、配送地址/状态等）。\n"
            "若最终回复缺少任一核心要素，completed=0，并在 missing 列出缺失要素关键词。\n"
            "只输出 JSON，格式：{\"completed\": 0或1, \"reason\": \"...\", \"missing\": [\"要素1\", \"要素2\"]}。\n\n"
            f"用户请求：{sample.user_query}\n"
            f"期望结果：{sample.ground_truth}\n"
            f"最终回复：{sample.final_answer}\n"
        )
        raw = self._call_llm(prompt, task_id=task_id)
        if raw is None:
            logger.warning("task_id=%s | LLM 返回 None，fallback 到规则评分", task_id)
            return self._rule_score(sample.final_answer or "")

        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                cleaned = cleaned.replace("json", "", 1).strip()
            parsed = json.loads(cleaned)
            completed = int(parsed.get("completed", 0))
            reason = parsed.get("reason", "")
            missing = parsed.get("missing", [])
            if missing:
                completed = 0
                if reason:
                    reason = f"{reason}；缺失要素：{', '.join(missing)}"
                else:
                    reason = f"缺失要素：{', '.join(missing)}"
            completed = 1 if completed == 1 else 0
            logger.info(
                "task_id=%s | LLM 判定: completed=%d, reason=%s, missing=%s",
                task_id, completed, reason, missing,
            )
            return MetricResult(
                value=float(completed),
                reason=reason or "LLM 判别",
                traces={"raw": raw, "missing": missing},
            )
        except Exception:
            logger.error("task_id=%s | LLM 输出解析失败, raw=%s", task_id, raw)
            return MetricResult(value=0.0, reason="LLM 输出解析失败", traces={"raw": raw})

    def score(self, sample) -> MetricResult:
        if self.use_llm:
            return self._llm_score(sample)
        return self._rule_score(sample.final_answer or "")

