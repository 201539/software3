from app.services.scenario_regression.scenario_regression_service import ScenarioRegressionService


class DummyLocator:
    def __init__(self, page, selector):
        self.page = page
        self.selector = selector

    def first(self):
        return self

    def click(self):
        self.page.events.append(("click", self.selector))

    def fill(self, value):
        self.page.events.append(("fill", self.selector, value))

    def press(self, value):
        self.page.events.append(("press", self.selector, value))

    def count(self):
        return 1 if self.selector in self.page.present_selectors else 0

    def inner_text(self):
        return self.page.body_text


class DummyPage:
    def __init__(self):
        self.url = "https://example.com"
        self.title_text = "Example Domain"
        self.body_text = "hello world"
        self.present_selectors = {"h1", "button[type='submit']", "input[name='username']"}
        self.events = []

    def set_default_timeout(self, timeout_ms):
        self.timeout_ms = timeout_ms

    def goto(self, target, wait_until="domcontentloaded"):
        self.url = target
        self.events.append(("goto", target, wait_until))

    def locator(self, selector):
        return DummyLocator(self, selector)

    def title(self):
        return self.title_text

    def wait_for_timeout(self, ms):
        self.events.append(("wait", ms))

    def screenshot(self, path, full_page=True):
        self.events.append(("screenshot", path, full_page))


class DummyContext:
    def __init__(self):
        self.page = DummyPage()

    def new_page(self):
        return self.page

    def close(self):
        pass


class DummyBrowser:
    def __init__(self):
        self.context = DummyContext()

    def new_context(self, ignore_https_errors=True):
        self.ignore_https_errors = ignore_https_errors
        return self.context

    def close(self):
        pass


class DummyPlaywright:
    class Chromium:
        def __init__(self, browser):
            self.browser = browser

        def launch(self, headless=True):
            return self.browser

    def __init__(self):
        self.browser = DummyBrowser()
        self.chromium = self.Chromium(self.browser)


class DummyPlaywrightManager:
    def __enter__(self):
        return DummyPlaywright()

    def __exit__(self, exc_type, exc, tb):
        return False


class DummyTraceService:
    def __init__(self):
        self.steps = []
        self.calls = []

    def add_step(self, **kwargs):
        self.steps.append(kwargs)

    def add_tool_call(self, **kwargs):
        self.calls.append(kwargs)


def test_scenario_regression_service_success(monkeypatch, tmp_path):
    from app.services.scenario_regression import scenario_regression_service as mod

    dummy_trace = DummyTraceService()
    monkeypatch.setattr(mod, "TraceService", dummy_trace)
    monkeypatch.setattr(mod, "sync_playwright", lambda: DummyPlaywrightManager())

    payload = {
        "scenario_name": "login_flow",
        "base_url": "https://example.com",
        "steps": [
            {"name": "check_home", "action": "assert_selector", "expect_selector": "h1"},
            {"name": "check_title", "action": "assert_title", "value": "Example"},
        ],
        "timeout_ms": 30000,
        "verify_ssl": True,
        "retry_policy": {"max_retries": 1, "backoff_ms": 10},
        "screenshot_dir": str(tmp_path),
    }

    result = ScenarioRegressionService.execute(db=object(), run_id="run_1", input_payload=payload)

    assert result["task_status"] == "success"
    assert result["step_pass_rate"] == 1.0
    assert result["failed_steps"] == []
    assert len(result["step_results"]) == 2
    assert dummy_trace.calls


def test_scenario_regression_service_retry_and_failure(monkeypatch, tmp_path):
    from app.services.scenario_regression import scenario_regression_service as mod

    class FailingPage(DummyPage):
        def locator(self, selector):
            loc = super().locator(selector)
            if selector == "h1":
                loc.count = lambda: 0
            return loc

    class FailingContext(DummyContext):
        def __init__(self):
            self.page = FailingPage()

    class FailingBrowser(DummyBrowser):
        def __init__(self):
            self.context = FailingContext()

    class FailingPlaywright(DummyPlaywright):
        def __init__(self):
            self.browser = FailingBrowser()
            self.chromium = self.Chromium(self.browser)

    class FailingManager:
        def __enter__(self):
            return FailingPlaywright()

        def __exit__(self, exc_type, exc, tb):
            return False

    dummy_trace = DummyTraceService()
    monkeypatch.setattr(mod, "TraceService", dummy_trace)
    monkeypatch.setattr(mod, "sync_playwright", lambda: FailingManager())

    payload = {
        "scenario_name": "retry_case",
        "base_url": "https://example.com",
        "steps": [
            {"name": "check_home", "action": "assert_selector", "expect_selector": "h1", "retry": 1},
            {"name": "never_reached", "action": "assert_text", "expect_text": "ok"},
        ],
        "timeout_ms": 30000,
        "verify_ssl": True,
        "retry_policy": {"max_retries": 1, "backoff_ms": 10},
        "screenshot_dir": str(tmp_path),
    }

    result = ScenarioRegressionService.execute(db=object(), run_id="run_2", input_payload=payload)

    assert result["task_status"] == "failed"
    assert result["step_pass_rate"] == 0.0
    assert result["failed_steps"] == ["check_home"]
    assert len(dummy_trace.calls) >= 1
