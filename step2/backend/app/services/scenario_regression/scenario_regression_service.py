"""Scenario Regression 执行服务。

职责：
- 按步骤真实执行场景回归；
- 记录步骤轨迹与工具调用日志；
- 输出结构化结果，供 run.result_json 复用。

说明：
- 这一版已接入 Playwright 真实浏览器执行；
- 若当前环境未安装 Playwright，则会返回明确错误，避免静默降级为假执行。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any

from app.services.traces.trace_service import TraceService

try:
    from playwright.sync_api import sync_playwright
except Exception:  # noqa: BLE001
    sync_playwright = None


@dataclass
class ScenarioStepResult:
    """单步骤执行结果。"""

    step_name: str
    success: bool
    evidence: str | None = None
    error: str | None = None


class ScenarioRegressionService:
    """场景回归执行服务。"""

    @staticmethod
    def execute(db, run_id: str, input_payload: dict[str, Any]) -> dict[str, Any]:
        """执行场景回归。"""
        scenario_name = str(input_payload.get("scenario_name", "")).strip() or "scenario"
        steps = input_payload.get("steps") or []
        assertions = input_payload.get("assertions") or []
        base_url = str(input_payload.get("base_url", "")).strip()
        timeout_ms = int(input_payload.get("timeout_ms", 30000))
        verify_ssl = bool(input_payload.get("verify_ssl", True))
        screenshot_dir = Path(input_payload.get("screenshot_dir", "step2/backend/artifacts/scenario_regression"))
        retry_policy = input_payload.get("retry_policy") or {}
        max_retries = int(retry_policy.get("max_retries", 1))
        retry_backoff_ms = int(retry_policy.get("backoff_ms", 500))

        if not steps:
            return {
                "task_status": "failed",
                "scenario_name": scenario_name,
                "step_results": [],
                "step_pass_rate": 0.0,
                "failed_steps": ["steps 不能为空"],
                "evidence": [],
                "summary": "steps 不能为空",
            }

        step_results: list[ScenarioStepResult] = []
        failed_steps: list[str] = []
        evidence: list[str] = []

        if sync_playwright is None:
            return {
                "task_status": "failed",
                "scenario_name": scenario_name,
                "step_results": [],
                "step_pass_rate": 0.0,
                "failed_steps": ["Playwright 未安装"],
                "evidence": [],
                "summary": "Scenario Regression 需要 Playwright 执行环境",
                "error": "playwright.sync_api unavailable",
            }

        screenshot_dir.mkdir(parents=True, exist_ok=True)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(ignore_https_errors=not verify_ssl)
            page = context.new_page()
            page.set_default_timeout(timeout_ms)

            try:
                if base_url:
                    start = perf_counter()
                    page.goto(base_url, wait_until="domcontentloaded")
                    duration_ms = int((perf_counter() - start) * 1000)
                    TraceService.add_tool_call(
                        db=db,
                        run_id=run_id,
                        tool_name="scenario_regression_goto",
                        input_payload={"base_url": base_url, "timeout_ms": timeout_ms, "verify_ssl": verify_ssl},
                        output_payload={"url": page.url, "title": page.title()},
                        success=True,
                        error_type=None,
                        duration_ms=duration_ms,
                    )

                for idx, step in enumerate(steps, start=1):
                    step_name = str(step.get("name", f"step_{idx}"))
                    action = str(step.get("action", "execute"))
                    selector = step.get("selector")
                    value = step.get("value")
                    url = step.get("url")
                    expect_text = step.get("expect_text")
                    expect_selector = step.get("expect_selector")
                    wait_ms = int(step.get("wait_ms", 0))
                    step_retry = int(step.get("retry", max_retries))

                    TraceService.add_step(
                        db=db,
                        run_id=run_id,
                        step_index=idx,
                        phase="act",
                        decision=f"执行步骤：{step_name}",
                        observation=f"action={action}",
                    )

                    start = perf_counter()
                    step_error: str | None = None
                    evidence_text: str = ""

                    for attempt in range(step_retry + 1):
                        try:
                            if action in {"goto", "navigate"}:
                                target = str(url or selector or value or base_url)
                                if not target:
                                    raise ValueError("goto action requires url")
                                page.goto(target, wait_until="domcontentloaded")
                                evidence_text = f"navigated:{page.url}"
                            elif action == "click":
                                if not selector:
                                    raise ValueError("click action requires selector")
                                page.locator(str(selector)).first.click()
                                evidence_text = f"clicked:{selector}"
                            elif action in {"fill", "type"}:
                                if not selector:
                                    raise ValueError("fill action requires selector")
                                page.locator(str(selector)).first.fill(str(value or ""))
                                evidence_text = f"filled:{selector}"
                            elif action == "press":
                                if not selector:
                                    raise ValueError("press action requires selector")
                                page.locator(str(selector)).first.press(str(value or "Enter"))
                                evidence_text = f"pressed:{selector}:{value or 'Enter'}"
                            elif action == "assert_text":
                                if expect_text is None:
                                    raise ValueError("assert_text action requires expect_text")
                                text = page.locator("body").inner_text()
                                if str(expect_text) not in text:
                                    raise AssertionError(f"expected text not found: {expect_text}")
                                evidence_text = f"assert_text_ok:{expect_text}"
                            elif action == "assert_selector":
                                if not expect_selector:
                                    raise ValueError("assert_selector action requires expect_selector")
                                locator = page.locator(str(expect_selector))
                                if locator.count() == 0:
                                    raise AssertionError(f"selector not found: {expect_selector}")
                                evidence_text = f"assert_selector_ok:{expect_selector}"
                            elif action == "assert_url":
                                expected_url = str(url or value or "")
                                if not expected_url:
                                    raise ValueError("assert_url action requires url or value")
                                if expected_url not in page.url:
                                    raise AssertionError(f"current url mismatch: {page.url} != {expected_url}")
                                evidence_text = f"assert_url_ok:{page.url}"
                            elif action == "assert_title":
                                expected_title = str(value or expect_text or "")
                                if not expected_title:
                                    raise ValueError("assert_title action requires value or expect_text")
                                if expected_title not in page.title():
                                    raise AssertionError(f"page title mismatch: {page.title()} != {expected_title}")
                                evidence_text = f"assert_title_ok:{page.title()}"
                            elif action == "screenshot":
                                file_path = screenshot_dir / f"{scenario_name}_{step_name}.png"
                                page.screenshot(path=str(file_path), full_page=True)
                                evidence_text = str(file_path)
                            elif action in {"wait", "sleep"}:
                                page.wait_for_timeout(wait_ms or int(value or 0) or 1000)
                                evidence_text = f"waited:{wait_ms or int(value or 0) or 1000}ms"
                            else:
                                raise ValueError(f"unsupported action: {action}")

                            if wait_ms and action not in {"wait", "sleep"}:
                                page.wait_for_timeout(wait_ms)

                            duration_ms = int((perf_counter() - start) * 1000)
                            TraceService.add_tool_call(
                                db=db,
                                run_id=run_id,
                                tool_name="scenario_regression_step",
                                input_payload={"step": step, "assertions": assertions, "attempt": attempt + 1},
                                output_payload={"success": True, "evidence": evidence_text, "url": page.url},
                                success=True,
                                error_type=None,
                                duration_ms=duration_ms,
                            )
                            step_results.append(ScenarioStepResult(step_name=step_name, success=True, evidence=evidence_text))
                            evidence.append(evidence_text)
                            step_error = None
                            break
                        except Exception as exc:  # noqa: BLE001
                            step_error = str(exc)
                            duration_ms = int((perf_counter() - start) * 1000)
                            TraceService.add_tool_call(
                                db=db,
                                run_id=run_id,
                                tool_name="scenario_regression_step",
                                input_payload={"step": step, "assertions": assertions, "attempt": attempt + 1},
                                output_payload={"success": False, "error": str(exc), "url": page.url},
                                success=False,
                                error_type=type(exc).__name__,
                                duration_ms=duration_ms,
                            )
                            if attempt < step_retry:
                                page.wait_for_timeout(retry_backoff_ms)
                                continue
                            break

                    if step_error:
                        step_results.append(ScenarioStepResult(step_name=step_name, success=False, error=step_error))
                        failed_steps.append(step_name)
                        TraceService.add_step(
                            db=db,
                            run_id=run_id,
                            step_index=idx,
                            phase="observe",
                            decision=f"观察步骤结果：{step_name}",
                            observation=step_error,
                        )
                        break

                    TraceService.add_step(
                        db=db,
                        run_id=run_id,
                        step_index=idx,
                        phase="observe",
                        decision=f"观察步骤结果：{step_name}",
                        observation=evidence_text,
                    )

                success_count = sum(1 for item in step_results if item.success)
                step_pass_rate = success_count / len(step_results)
                task_status = "success" if step_pass_rate == 1.0 else "failed"

                if task_status != "success" and not failed_steps:
                    failed_steps = [item.step_name for item in step_results if not item.success]

                summary = "场景回归执行完成" if task_status == "success" else "场景回归执行失败"

                return {
                    "task_status": task_status,
                    "scenario_name": scenario_name,
                    "step_results": [item.__dict__ for item in step_results],
                    "step_pass_rate": step_pass_rate,
                    "failed_steps": failed_steps,
                    "evidence": evidence,
                    "summary": summary,
                    "current_url": page.url,
                }
            finally:
                context.close()
                browser.close()
