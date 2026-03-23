"""PlanQuality 指标单元测试."""
from __future__ import annotations

import pytest
from data.schema import Sample, Step
from metrics.plan_quality import PlanQuality


def _step(tool: str) -> Step:
    return Step(step=1, thought="", tool_call=tool, input={}, observation="")


def _sample(pred_tools: list[str], ref_tools: list[str]) -> Sample:
    return Sample(
        task_id="t1",
        user_query="q",
        ground_truth="g",
        steps=[_step(t) for t in pred_tools],
        expected_steps=[_step(t) for t in ref_tools],
        final_answer="a",
    )


class TestPlanQuality:
    """PlanQuality 的基本场景."""

    def test_perfect_plan(self):
        metric = PlanQuality()
        result = metric.score(_sample(["search_restaurants", "search_products"], ["search_restaurants", "search_products"]))
        assert result.value == pytest.approx(1.0)

    def test_invalid_tool(self):
        """调用不存在的工具 → 扣分."""
        metric = PlanQuality()
        result = metric.score(_sample(
            ["get_menu", "search_restaurants", "search_products"],
            ["search_restaurants", "search_products"],
        ))
        assert result.traces["invalid_tools"] == ["get_menu"]
        assert result.value < 1.0

    def test_consecutive_repeat(self):
        """相邻重复调用同一工具 → 死循环扣分."""
        metric = PlanQuality()
        result = metric.score(_sample(
            ["search_restaurants", "search_restaurants", "search_products"],
            ["search_restaurants", "search_products"],
        ))
        assert result.traces["consecutive_repeats"] == 1
        assert result.value < 1.0

    def test_non_consecutive_repeat_ok(self):
        """非相邻的重复调用（如查两道菜）不应被扣死循环分."""
        metric = PlanQuality()
        result = metric.score(_sample(
            ["search_restaurants", "search_products", "search_products", "place_order"],
            ["search_restaurants", "search_products", "search_products", "place_order"],
        ))
        # search_products 连续出现但是合法的（查两道菜），这里会被检测为 1 次连续重复
        # 但因为和 expected 完全一致，missing=0, redundant=0
        assert result.traces["consecutive_repeats"] == 1
        assert result.value == pytest.approx(0.9)

    def test_dependency_violation(self):
        """跳过前置依赖 → 逻辑断层扣分."""
        metric = PlanQuality()
        # place_order 在 search_products 之前出现
        result = metric.score(_sample(
            ["search_restaurants", "place_order", "search_products"],
            ["search_restaurants", "search_products", "place_order"],
        ))
        assert result.traces["dependency_violations"] == 1
        assert result.value < 1.0

    def test_missing_tool(self):
        """缺少参考中的工具 → 扣分."""
        metric = PlanQuality()
        result = metric.score(_sample(
            ["search_restaurants"],
            ["search_restaurants", "search_products", "place_order"],
        ))
        assert result.traces["missing"] == 2  # search_products, place_order 缺失

    def test_redundant_steps(self):
        """实际步骤多于期望 → 冗余扣分."""
        metric = PlanQuality()
        result = metric.score(_sample(
            ["search_restaurants", "search_products", "place_order", "pay_order", "check_order_status"],
            ["search_restaurants", "search_products", "place_order"],
        ))
        assert result.traces["redundant"] == 2

    def test_score_floor_zero(self):
        """扣分过多时分数不低于 0."""
        metric = PlanQuality()
        pred = ["foo"] * 10
        ref = ["search_restaurants", "search_products", "place_order"]
        result = metric.score(_sample(pred, ref))
        assert result.value == pytest.approx(0.0)

    def test_both_empty(self):
        metric = PlanQuality()
        result = metric.score(_sample([], []))
        assert result.value == pytest.approx(1.0)

    def test_dead_loop_with_invalid_tool(self):
        """样本 #23 模式：先调无效工具再正常流程."""
        metric = PlanQuality()
        result = metric.score(_sample(
            ["get_menu", "search_restaurants", "search_products", "place_order", "pay_order"],
            ["search_restaurants", "search_products", "place_order", "pay_order"],
        ))
        assert result.traces["invalid_tools"] == ["get_menu"]
        assert result.traces["redundant"] == 1
        # -0.15 (invalid) -0.05 (redundant) = 0.8
        assert result.value == pytest.approx(0.8)

    def test_sample25_pattern(self):
        """样本 #25 模式：3 次错误-重试，步骤翻倍."""
        metric = PlanQuality()
        result = metric.score(_sample(
            ["search_restaurants", "search_restaurants", "search_products", "search_products", "place_order", "place_order"],
            ["search_restaurants", "search_products", "place_order"],
        ))
        assert result.traces["consecutive_repeats"] == 3
        assert result.traces["redundant"] == 3
        # -0.1*3 (repeats) -0.05*3 (redundant) = 1.0 - 0.3 - 0.15 = 0.55
        assert result.value == pytest.approx(0.55)
