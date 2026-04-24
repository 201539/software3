from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.analysis_api import router as analysis_router
from app.api.dataset_api import router as dataset_router
from app.api.metric_api import router as metric_router
from app.api.report_api import router as report_router
from app.api.run_api import router as run_router
from app.api.task_api import router as task_router
from app.api.trace_api import router as trace_router
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AI Coding Agent Evaluation Platform", version="0.1.0", lifespan=lifespan)

app.include_router(task_router)
app.include_router(run_router)
app.include_router(dataset_router)
app.include_router(metric_router)
app.include_router(trace_router)
app.include_router(report_router)
app.include_router(analysis_router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
