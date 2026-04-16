"""Web Health Check 执行服务。

职责：
- 按输入配置访问页面；
- 检查页面可访问性与关键选择器存在性；
- 产出结构化巡检结果，供 run.final_summary 与结果接口复用。
"""

from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.services.llm.doubao_provider import DoubaoProvider


@dataclass
class PageCheckResult:
    """单页面巡检结果。"""

    page: str
    url: str
    reachable: bool
    status_code: int | None
    missing_selectors: list[str]
    error: str | None


class WebHealthCheckService:
    """网页巡检服务。"""

    @staticmethod
    def execute(input_payload: dict[str, Any]) -> dict[str, Any]:
        """执行网页巡检。

        输入字段：
        - base_url: 站点地址
        - pages: 需要检查的页面路径数组
        - required_selectors: 每个页面需存在的 CSS 选择器映射
        - timeout_ms: 请求超时时间
        - verify_ssl: 是否校验 HTTPS 证书（默认 true；开发联调可设为 false）
        """
        base_url = str(input_payload.get("base_url", "")).strip()
        pages = input_payload.get("pages") or ["/"]
        required_selectors = input_payload.get("required_selectors") or {}
        timeout_ms = int(input_payload.get("timeout_ms", 15000))
        verify_ssl = bool(input_payload.get("verify_ssl", True))

        if not base_url:
            return {
                "task_status": "failed",
                "page_results": [],
                "missing_selectors": {},
                "summary": "base_url 不能为空",
            }

        page_results: list[PageCheckResult] = []
        missing_selectors_map: dict[str, list[str]] = {}

        with httpx.Client(timeout=timeout_ms / 1000, verify=verify_ssl) as client:
            for page in pages:
                url = urljoin(base_url, page)
                expect_selectors = required_selectors.get(page, [])

                try:
                    resp = client.get(url)
                    reachable = 200 <= resp.status_code < 400

                    missing: list[str] = []
                    if reachable and expect_selectors:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        for selector in expect_selectors:
                            if not soup.select_one(selector):
                                missing.append(selector)

                    if missing:
                        missing_selectors_map[page] = missing

                    page_results.append(
                        PageCheckResult(
                            page=page,
                            url=url,
                            reachable=reachable,
                            status_code=resp.status_code,
                            missing_selectors=missing,
                            error=None,
                        )
                    )
                except Exception as exc:  # noqa: BLE001
                    page_results.append(
                        PageCheckResult(
                            page=page,
                            url=url,
                            reachable=False,
                            status_code=None,
                            missing_selectors=expect_selectors,
                            error=str(exc),
                        )
                    )
                    missing_selectors_map[page] = list(expect_selectors)

        any_unreachable = any(not p.reachable for p in page_results)
        any_missing = any(len(p.missing_selectors) > 0 for p in page_results)
        task_status = "success" if not any_unreachable and not any_missing else "failed"

        if task_status == "success":
            summary = "所有页面可访问且关键元素存在"
        else:
            summary = "存在页面不可访问或关键元素缺失"

        result = {
            "task_status": task_status,
            "page_results": [p.__dict__ for p in page_results],
            "missing_selectors": missing_selectors_map,
            "summary": summary,
        }

        use_llm = bool(input_payload.get("use_llm", False))
        if use_llm:
            llm_result = DoubaoProvider().summarize_web_health_check(result)
            result["llm_summary"] = llm_result.get("summary")
            result["llm_error"] = llm_result.get("error")
            result["llm_enabled"] = llm_result.get("enabled", False)
            if llm_result.get("summary"):
                result["summary"] = llm_result["summary"]

        return result
