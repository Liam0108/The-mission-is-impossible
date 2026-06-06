import csv
from io import StringIO
from typing import Any

from app.schemas.trade import TradeCreate
from app.services.normalization import plain


TRADE_CSV_FIELDS = [
    "user_id",
    "workspace_id",
    "date",
    "instrument",
    "data_type",
    "session",
    "direction",
    "bias_15m",
    "market_state",
    "regime_label",
    "location",
    "liquidity_sweep",
    "choch",
    "lh_hl",
    "fvg_reaction",
    "volume_state",
    "strategy_version",
    "setup_type",
    "setup_score",
    "manual_quality",
    "trade_decision",
    "skip_reason",
    "entry_price",
    "stop_loss",
    "tp1_price",
    "tp2_price",
    "risk_amount",
    "result",
    "result_r",
    "mfe",
    "mae",
    "distance_to_poc",
    "distance_to_vah",
    "distance_to_val",
    "poc_risk_level",
    "similarity_group_id",
    "management_rule_notes",
    "screenshot_tags",
    "screenshot_favorite",
    "screenshot_bookmarked",
    "screenshot_notes",
    "lessons_learned",
    "followed_plan",
    "mistake_type",
    "discipline_score",
    "execution_score",
    "emotion_score",
    "review_notes",
    "daily_bias",
    "weekly_bias",
    "monthly_bias",
    "high_impact_news",
    "news_type",
    "news_timing",
    "notes",
    "screenshot_path",
    "data_quality",
    "account",
    "broker_symbol",
    "buy_price",
    "sell_price",
    "bought_time",
    "sold_time",
    "quantity",
    "entry_time",
    "exit_time",
    "exit_price",
    "gross_pnl",
    "commission",
    "net_pnl",
    "broker_trade_id",
    "import_source",
    "holding_time_minutes",
    "holding_time_text",
    "imported",
    "review_status",
]


def parse_trades_csv(raw_csv: str) -> list[TradeCreate]:
    reader = csv.DictReader(StringIO(raw_csv))
    trades = []
    for row in reader:
        cleaned = {key: (value.strip() if isinstance(value, str) else value) for key, value in row.items()}
        for optional_field in [
            "user_id",
            "workspace_id",
            "strategy_version",
            "setup_type",
            "regime_label",
            "setup_score",
            "manual_quality",
            "skip_reason",
            "entry_price",
            "stop_loss",
            "tp1_price",
            "tp2_price",
            "risk_amount",
            "distance_to_poc",
            "distance_to_vah",
            "distance_to_val",
            "similarity_group_id",
            "management_rule_notes",
            "screenshot_tags",
            "screenshot_notes",
            "lessons_learned",
            "discipline_score",
            "execution_score",
            "emotion_score",
            "review_notes",
            "news_type",
            "notes",
            "screenshot_path",
            "account",
            "broker_symbol",
            "buy_price",
            "sell_price",
            "bought_time",
            "sold_time",
            "quantity",
            "entry_time",
            "exit_time",
            "exit_price",
            "gross_pnl",
            "commission",
            "net_pnl",
            "broker_trade_id",
            "import_source",
            "holding_time_minutes",
            "holding_time_text",
        ]:
            if cleaned.get(optional_field) == "":
                cleaned[optional_field] = None
        if not cleaned.get("trade_decision"):
            cleaned["trade_decision"] = "Taken"
        if not cleaned.get("poc_risk_level"):
            cleaned["poc_risk_level"] = "Unknown"
        if not cleaned.get("data_quality"):
            cleaned["data_quality"] = "incomplete"
        if not cleaned.get("review_status"):
            cleaned["review_status"] = "reviewed"
        cleaned.setdefault("followed_plan", "Yes")
        cleaned.setdefault("mistake_type", "None")
        cleaned.setdefault("daily_bias", "Neutral")
        cleaned.setdefault("weekly_bias", "Neutral")
        cleaned.setdefault("monthly_bias", "Neutral")
        cleaned.setdefault("high_impact_news", "No")
        cleaned.setdefault("news_timing", "No News")
        for bool_field in ["screenshot_favorite", "screenshot_bookmarked", "imported"]:
            if cleaned.get(bool_field) in {"", None}:
                cleaned[bool_field] = False
        if cleaned.get("result_r") == "":
            cleaned["result_r"] = None
        for numeric_field in ["mfe", "mae"]:
            if cleaned.get(numeric_field) == "":
                cleaned[numeric_field] = 0
        trades.append(TradeCreate.model_validate(cleaned))
    return trades


def render_trades_csv(trades: list[Any]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", *TRADE_CSV_FIELDS, "created_at", "updated_at"])
    writer.writeheader()
    for trade in trades:
        row = {}
        for field in writer.fieldnames:
            value = getattr(trade, field, "")
            row[field] = plain(value)
        writer.writerow(row)
    return output.getvalue()
