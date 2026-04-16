"""任务接口层。

说明：
- 提供通用任务创建接口；
- 提供 6 类任务的快捷创建接口（统一包装为 TaskCreate）；
- 提供任务列表与详情查询；
- 统一返回 ApiResponse。
"""

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.error_codes import TASK_NOT_FOUND
from app.core.exceptions import AppException
from app.schemas.common import ApiResponse, PageResponse, build_page_response, success_response
from app.schemas.task import TaskCreate, TaskDetail, TaskOut
from app.services.tasks.task_service import TaskService

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


@router.post("", response_model=ApiResponse[TaskOut], status_code=201)
def create_task(payload: TaskCreate, request: Request, db: Session = Depends(get_db)):
    """通用任务创建接口。"""
    task = TaskService.create_task(db, payload)
    data = TaskOut(task_id=task.id, task_type=task.task_type, status=task.status, created_at=task.created_at)
    return success_response(data, request_id=_request_id(request))


def _create_typed_task(
    task_type: str,
    default_title: str,
    payload: dict[str, Any],
    request: Request,
    db: Session,
) -> ApiResponse[TaskOut]:
    """统一封装 6 类任务快捷创建逻辑，减少重复代码。"""
    wrapped = TaskCreate(task_type=task_type, title=payload.get("title", default_title), input_payload=payload)
    task = TaskService.create_task(db, wrapped)
    data = TaskOut(task_id=task.id, task_type=task.task_type, status=task.status, created_at=task.created_at)
    return success_response(data, request_id=_request_id(request))


@router.post("/web-health-check", response_model=ApiResponse[TaskOut], status_code=201)
def create_web_health_check_task(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    """创建网页巡检任务。"""
    return _create_typed_task("web_health_check", "Web Health Check", payload, request, db)


@router.post("/scenario-regression", response_model=ApiResponse[TaskOut], status_code=201)
def create_scenario_regression_task(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    """创建业务流程回归任务。"""
    return _create_typed_task("scenario_regression", "Scenario Regression", payload, request, db)


@router.post("/form-automation", response_model=ApiResponse[TaskOut], status_code=201)
def create_form_automation_task(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    """创建表单自动化任务。"""
    return _create_typed_task("form_automation", "Form Automation", payload, request, db)


@router.post("/web-extraction", response_model=ApiResponse[TaskOut], status_code=201)
def create_web_extraction_task(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    """创建网页采集任务。"""
    return _create_typed_task("web_extraction", "Web Extraction", payload, request, db)


@router.post("/cicd-inspection", response_model=ApiResponse[TaskOut], status_code=201)
def create_cicd_inspection_task(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    """创建 CI/CD 巡检任务。"""
    return _create_typed_task("cicd_inspection", "CI/CD Inspection", payload, request, db)


@router.post("/release-gate", response_model=ApiResponse[TaskOut], status_code=201)
def create_release_gate_task(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    """创建发布门禁任务。"""
    return _create_typed_task("release_gate", "Release Gate", payload, request, db)


@router.get("", response_model=ApiResponse[PageResponse[TaskOut]])
def list_tasks(
    request: Request,
    task_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """分页查询任务列表。"""
    tasks, total = TaskService.list_tasks(db, task_type=task_type, status=status, page=page, page_size=page_size)
    items = [TaskOut(task_id=t.id, task_type=t.task_type, status=t.status, created_at=t.created_at) for t in tasks]
    page_data = build_page_response(items=items, page=page, page_size=page_size, total=total)
    return success_response(page_data, request_id=_request_id(request))


@router.get("/{task_id}", response_model=ApiResponse[TaskDetail])
def get_task(task_id: str, request: Request, db: Session = Depends(get_db)):
    """查询任务详情。"""
    task = TaskService.get_task(db, task_id)
    if not task:
        raise AppException(code=TASK_NOT_FOUND, message="任务不存在", status_code=404)

    data = TaskDetail(
        task_id=task.id,
        task_type=task.task_type,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        title=task.title,
        input_payload=task.input_payload,
    )
    return success_response(data, request_id=_request_id(request))
