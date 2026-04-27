from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.analysis_repository import AnalysisRepository
from app.schemas.analysis import AnalysisCompareRequest, AnalysisCompareResponse
from app.services.analysis_service.analysis_manager import AnalysisManager

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


def get_analysis_manager(db: Session = Depends(get_db)) -> AnalysisManager:
    return AnalysisManager(AnalysisRepository(db))


@router.post("/compare", response_model=AnalysisCompareResponse)
def compare_analysis(payload: AnalysisCompareRequest, manager: AnalysisManager = Depends(get_analysis_manager)):
    return manager.compare(payload)


@router.get("", response_model=list[AnalysisCompareResponse])
def list_analyses(manager: AnalysisManager = Depends(get_analysis_manager)):
    return manager.list_analyses()


@router.get("/{analysis_id}", response_model=AnalysisCompareResponse)
def get_analysis(analysis_id: int, manager: AnalysisManager = Depends(get_analysis_manager)):
    analysis = manager.get_analysis(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis
