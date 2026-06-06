from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketCandle(Base):
    __tablename__ = "market_candles"
    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "timestamp", name="uq_market_candles_symbol_timeframe_timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    raw_timestamp: Mapped[str | None] = mapped_column(Text)
    source_row_index: Mapped[int | None] = mapped_column(Integer)
    source_symbol: Mapped[str | None] = mapped_column(String(32))
    source_filename: Mapped[str | None] = mapped_column(Text)
    open: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    volume: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SetupCandidateLog(Base):
    __tablename__ = "setup_candidate_logs"
    __table_args__ = (
        UniqueConstraint(
            "symbol",
            "timeframe",
            "timestamp",
            "setup_type",
            "direction",
            name="uq_setup_candidate_logs_identity",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)
    setup_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    reasons: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
