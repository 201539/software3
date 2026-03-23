from __future__ import annotations

from .base import Metric, MetricResult

# 外卖 Agent 场景的合法工具集
VALID_TOOLS = {
    "search_restaurants",
    "search_products",
    "place_order",
    "pay_order",
    "check_order_status",
}

# 工具依赖链：key 需要 value 在它之前出现
DEPENDENCIES = {
    "search_products": "search_restaurants",
    "place_order": "search_products",
    "pay_order": "place_order",
}


class PlanQuality(Metric):
    name = "plan_quality"

    def score(self, sample) -> MetricResult:
        tool_calls = [s.tool_call for s in sample.steps]
        expected_tools = [s.tool_call for s in sample.expected_steps]

        # 1. 无效工具检测：调用了不存在的工具（幻觉工具）
        invalid_tools = [t for t in tool_calls if t not in VALID_TOOLS]

        # 2. 死循环检测：相邻步骤调用同一工具
        consecutive_repeats = sum(
            1 for i in range(1, len(tool_calls))
            if tool_calls[i] == tool_calls[i - 1]
        )

        # 3. 逻辑断层检测：工具在其前置依赖之前出现
        dependency_violations = 0
        seen = set()
        for t in tool_calls:
            if t in DEPENDENCIES and DEPENDENCIES[t] not in seen:
                dependency_violations += 1
            seen.add(t)

        # 4. 缺失工具检测：期望中的工具未出现在实际调用中
        missing = len([t for t in expected_tools if t not in tool_calls])

        # 5. 冗余步骤：实际步骤多于期望步骤
        redundant = max(0, len(tool_calls) - len(expected_tools))

        # 扣分计算
        raw = 1.0
        raw -= 0.15 * len(invalid_tools)
        raw -= 0.10 * consecutive_repeats
        raw -= 0.10 * dependency_violations
        raw -= 0.10 * missing
        raw -= 0.05 * redundant
        score = max(0.0, raw)

        return MetricResult(
            value=score,
            reason="规划合理性",
            traces={
                "invalid_tools": invalid_tools,
                "consecutive_repeats": consecutive_repeats,
                "dependency_violations": dependency_violations,
                "missing": missing,
                "redundant": redundant,
            },
        )
