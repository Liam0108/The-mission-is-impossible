import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.constants import (
    DATA_TYPES,
    DATA_QUALITY_VALUES,
    DIRECTIONS,
    CHOCH_TIMEFRAMES,
    ENTRY_PULLBACK_STRUCTURES,
    BIAS_VALUES,
    FOLLOWED_PLAN_VALUES,
    FVG_REACTIONS,
    INSTRUMENTS,
    LOCATIONS,
    MANUAL_QUALITIES,
    MARKET_STATES,
    MISTAKE_TYPES,
    NEWS_TIMINGS,
    NEWS_TYPES,
    POC_RISK_LEVELS,
    REGIME_LABELS,
    REVIEW_STATUSES,
    RESULTS,
    SESSIONS,
    SETUP_TYPES,
    SKIP_REASONS,
    SWEEP_TIMEFRAMES,
    TRADE_DECISIONS,
    VOLUME_STATES,
    YES_NO,
)
from app.db.base import Base


def _in_values(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (
        CheckConstraint(f"instrument IN ({_in_values(INSTRUMENTS)})", name="ck_trades_instrument"),
        CheckConstraint(f"data_type IN ({_in_values(DATA_TYPES)})", name="ck_trades_data_type"),
        CheckConstraint(f"session IN ({_in_values(SESSIONS)})", name="ck_trades_session"),
        CheckConstraint(f"direction IN ({_in_values(DIRECTIONS)})", name="ck_trades_direction"),
        CheckConstraint(f"market_state IN ({_in_values(MARKET_STATES)})", name="ck_trades_market_state"),
        CheckConstraint(
            f"regime_label IS NULL OR regime_label IN ({_in_values(REGIME_LABELS)})",
            name="ck_trades_regime_label",
        ),
        CheckConstraint(f"location IN ({_in_values(LOCATIONS)})", name="ck_trades_location"),
        CheckConstraint(f"liquidity_sweep IN ({_in_values(SWEEP_TIMEFRAMES)})", name="ck_trades_liquidity_sweep"),
        CheckConstraint(f"choch IN ({_in_values(CHOCH_TIMEFRAMES)})", name="ck_trades_choch"),
        CheckConstraint(f"lh_hl IN ({_in_values(ENTRY_PULLBACK_STRUCTURES)})", name="ck_trades_lh_hl"),
        CheckConstraint(f"fvg_reaction IN ({_in_values(FVG_REACTIONS)})", name="ck_trades_fvg_reaction"),
        CheckConstraint(f"volume_state IN ({_in_values(VOLUME_STATES)})", name="ck_trades_volume_state"),
        CheckConstraint(f"result IN ({_in_values(RESULTS)})", name="ck_trades_result"),
        CheckConstraint(f"trade_decision IN ({_in_values(TRADE_DECISIONS)})", name="ck_trades_trade_decision"),
        CheckConstraint(
            f"skip_reason IS NULL OR skip_reason IN ({_in_values(SKIP_REASONS)})",
            name="ck_trades_skip_reason",
        ),
        CheckConstraint(f"poc_risk_level IN ({_in_values(POC_RISK_LEVELS)})", name="ck_trades_poc_risk_level"),
        CheckConstraint(f"followed_plan IN ({_in_values(FOLLOWED_PLAN_VALUES)})", name="ck_trades_followed_plan"),
        CheckConstraint(f"mistake_type IN ({_in_values(MISTAKE_TYPES)})", name="ck_trades_mistake_type"),
        CheckConstraint("discipline_score IS NULL OR discipline_score BETWEEN 1 AND 10", name="ck_trades_discipline_score"),
        CheckConstraint("execution_score IS NULL OR execution_score BETWEEN 1 AND 10", name="ck_trades_execution_score"),
        CheckConstraint("emotion_score IS NULL OR emotion_score BETWEEN 1 AND 10", name="ck_trades_emotion_score"),
        CheckConstraint(f"daily_bias IN ({_in_values(BIAS_VALUES)})", name="ck_trades_daily_bias"),
        CheckConstraint(f"weekly_bias IN ({_in_values(BIAS_VALUES)})", name="ck_trades_weekly_bias"),
        CheckConstraint(f"monthly_bias IN ({_in_values(BIAS_VALUES)})", name="ck_trades_monthly_bias"),
        CheckConstraint(f"high_impact_news IN ({_in_values(YES_NO)})", name="ck_trades_high_impact_news"),
        CheckConstraint(
            f"news_type IS NULL OR news_type IN ({_in_values(NEWS_TYPES)})",
            name="ck_trades_news_type",
        ),
        CheckConstraint(f"news_timing IN ({_in_values(NEWS_TIMINGS)})", name="ck_trades_news_timing"),
        CheckConstraint("setup_score IS NULL OR setup_score BETWEEN 0 AND 100", name="ck_trades_setup_score"),
        CheckConstraint(
            f"manual_quality IS NULL OR manual_quality IN ({_in_values(MANUAL_QUALITIES)})",
            name="ck_trades_manual_quality",
        ),
        CheckConstraint(f"data_quality IN ({_in_values(DATA_QUALITY_VALUES)})", name="ck_trades_data_quality"),
        CheckConstraint(f"setup_type IS NULL OR setup_type IN ({_in_values(SETUP_TYPES)})", name="ck_trades_setup_type"),
        CheckConstraint(f"review_status IN ({_in_values(REVIEW_STATUSES)})", name="ck_trades_review_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str | None] = mapped_column(String(64), index=True)
    workspace_id: Mapped[str | None] = mapped_column(String(64), index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    instrument: Mapped[str] = mapped_column(String(12), nullable=False)
    data_type: Mapped[str] = mapped_column(String(16), nullable=False)
    session: Mapped[str] = mapped_column(String(16), nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)
    bias_15m: Mapped[str] = mapped_column(String(32), nullable=False)
    market_state: Mapped[str] = mapped_column(String(16), nullable=False)
    regime_label: Mapped[str | None] = mapped_column(String(24), index=True)
    location: Mapped[str] = mapped_column(String(16), nullable=False)
    liquidity_sweep: Mapped[str] = mapped_column(String(24), nullable=False)
    choch: Mapped[str] = mapped_column(String(8), nullable=False)
    lh_hl: Mapped[str] = mapped_column(String(16), nullable=False)
    fvg_reaction: Mapped[str] = mapped_column(String(8), nullable=False)
    volume_state: Mapped[str] = mapped_column(String(8), nullable=False)
    strategy_version: Mapped[str | None] = mapped_column(String(32), index=True)
    setup_type: Mapped[str | None] = mapped_column(String(32), index=True)
    setup_score: Mapped[int | None] = mapped_column(Integer)
    manual_quality: Mapped[str | None] = mapped_column(String(8))
    trade_decision: Mapped[str] = mapped_column(String(16), nullable=False, default="Taken")
    skip_reason: Mapped[str | None] = mapped_column(String(32))
    entry_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    tp1_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    tp2_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    risk_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    result: Mapped[str] = mapped_column(String(8), nullable=False, default="NoTrade")
    result_r: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True, default=0)
    mfe: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    mae: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    distance_to_poc: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    distance_to_vah: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    distance_to_val: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    poc_risk_level: Mapped[str] = mapped_column(String(8), nullable=False, default="Unknown")
    similarity_group_id: Mapped[str | None] = mapped_column(String(64), index=True)
    management_rule_notes: Mapped[str | None] = mapped_column(Text)
    screenshot_tags: Mapped[str | None] = mapped_column(Text)
    screenshot_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    screenshot_bookmarked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    screenshot_notes: Mapped[str | None] = mapped_column(Text)
    lessons_learned: Mapped[str | None] = mapped_column(Text)
    followed_plan: Mapped[str] = mapped_column(String(16), nullable=False, default="Yes")
    mistake_type: Mapped[str] = mapped_column(String(32), nullable=False, default="None")
    discipline_score: Mapped[int | None] = mapped_column(Integer)
    execution_score: Mapped[int | None] = mapped_column(Integer)
    emotion_score: Mapped[int | None] = mapped_column(Integer)
    review_notes: Mapped[str | None] = mapped_column(Text)
    daily_bias: Mapped[str] = mapped_column(String(8), nullable=False, default="Neutral")
    weekly_bias: Mapped[str] = mapped_column(String(8), nullable=False, default="Neutral")
    monthly_bias: Mapped[str] = mapped_column(String(8), nullable=False, default="Neutral")
    high_impact_news: Mapped[str] = mapped_column(String(3), nullable=False, default="No")
    news_type: Mapped[str | None] = mapped_column(String(24))
    news_timing: Mapped[str] = mapped_column(String(16), nullable=False, default="No News")
    notes: Mapped[str | None] = mapped_column(Text)
    screenshot_path: Mapped[str | None] = mapped_column(Text)
    data_quality: Mapped[str] = mapped_column(String(16), nullable=False, default="incomplete", index=True)
    account: Mapped[str | None] = mapped_column(String(64), index=True)
    broker_symbol: Mapped[str | None] = mapped_column(String(32))
    buy_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    sell_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    bought_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sold_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    entry_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    exit_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    exit_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    gross_pnl: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    commission: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    net_pnl: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    broker_trade_id: Mapped[str | None] = mapped_column(String(64), index=True)
    import_source: Mapped[str | None] = mapped_column(String(32))
    holding_time_minutes: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    holding_time_text: Mapped[str | None] = mapped_column(String(64))
    imported: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    review_status: Mapped[str] = mapped_column(String(16), nullable=False, default="reviewed", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
