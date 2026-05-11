from sqlalchemy import BigInteger, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, TimestampMixin


class AnalysisResult(TimestampMixin, Base):
    __tablename__ = "analysis_result"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    analysis_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    task_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    metric_keys: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
