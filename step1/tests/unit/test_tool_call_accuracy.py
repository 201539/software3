"""ToolCallAccuracy 指标单元测试."""
from __future__ import annotations

import pytest
from data.schema import Sample, Step
from metrics.tool_call_accuracy import ToolCallAccuracy


def _step(tool: str, inp: dict | None = None, step_no: int = 1) -> Step:
    return Step(step=step_no, thought="", tool_call=tool, input=inp or {}, observation="")


def _sample(pred_steps: list[Step], ref_steps: list[Step]) -> Sample:
    return Sample(
        task_id="t1",
        user_query="q",
        ground_truth="g",
        steps=pred_steps,
        expected_steps=ref_steps,
        final_answer="a",
    )


class TestToolCallAccuracy:
    """ToolCallAccuracy 的基本场景."""

    def test_both_empty(self):
        metric = ToolCallAccuracy()
        result = metric.score(_sample([], []))
        assert result.value == 1.0

    def test_pred_empty_ref_nonempty(self):
        metric = ToolCallAccuracy()
        result = metric.score(_sample([], [_step("search")]))
        assert result.value == 0.0

    def test_pred_nonempty_ref_empty(self):
        metric = ToolCallAccuracy()
        result = metric.score(_sample([_step("search")], []))
        assert result.value == 0.0

    def test_perfect_match(self):
        steps = [_step("search", {"q": "pizza"}), _step("order", {"id": "1"})]
        metric = ToolCallAccuracy(strict_order=True)
        result = metric.score(_sample(steps, steps))
        assert result.value == pytest.approx(1.0)

    def test_same_tools_different_args(self):
        pred = [_step("search", {"q": "burger"})]
        ref = [_step("search", {"q": "pizza"})]
        metric = ToolCallAccuracy(strict_order=True)
        result = metric.score(_sample(pred, ref))
        # 工具名匹配但参数不同 → arg_score=0, aligned=1, coverage=1 → 0.0
        assert result.value == pytest.approx(0.0)

    def test_order_mismatch_strict(self):
        pred = [_step("order"), _step("search")]
        ref = [_step("search"), _step("order")]
        metric = ToolCallAccuracy(strict_order=True)
        result = metric.score(_sample(pred, ref))
        # aligned=0 → score=0
        assert result.value == pytest.approx(0.0)

    def test_order_mismatch_not_strict(self):
        pred = [_step("order", {"id": "1"}), _step("search", {"q": "p"})]
        ref = [_step("search", {"q": "p"}), _step("order", {"id": "1"})]
        metric = ToolCallAccuracy(strict_order=False)
        result = metric.score(_sample(pred, ref))
        # 非严格模式：排序后正确配对 order↔order, search↔search → 1.0
        assert result.value == pytest.approx(1.0)

    def test_partial_arg_match(self):
        pred = [_step("search", {"q": "pizza", "city": "nj"})]
        ref = [_step("search", {"q": "pizza", "city": "ny"})]
        metric = ToolCallAccuracy(strict_order=True)
        result = metric.score(_sample(pred, ref))
        # 1 out of 2 args match → arg_score=0.5, coverage=1, aligned=1 → 0.5
        assert result.value == pytest.approx(0.5)

    def test_extra_pred_steps(self):
        pred = [_step("search"), _step("order"), _step("pay")]
        ref = [_step("search"), _step("order")]
        metric = ToolCallAccuracy(strict_order=True)
        result = metric.score(_sample(pred, ref))
        # aligned: pred_seq != ref_seq (长度不同) → 0
        assert result.value == pytest.approx(0.0)

    def test_type_mismatch_args(self):
        """参数值类型不同但字符串相等时应视为匹配（与 Ragas str() 对齐）。"""
        pred = [_step("search", {"count": "5", "name": "pizza"})]
        ref = [_step("search", {"count": 5, "name": "pizza"})]
        metric = ToolCallAccuracy(strict_order=True)
        result = metric.score(_sample(pred, ref))
        assert result.value == pytest.approx(1.0)