from collections import defaultdict
from typing import Any

from app.services.normalization import as_float, as_str, value_of


def _rate(count: int, total: int) -> float:
    return round((count / total) * 100, 1) if total else 0.0


def review_analytics(trades: list[Any]) -> dict[str, Any]:
    groups: dict[str, list[Any]] = defaultdict(list)
    for trade in trades:
        groups[as_str(value_of(trade, "mistake_type", "None")) or "None"].append(trade)

    rows = []
    for mistake, group in groups.items():
        losses = [trade for trade in group if as_float(value_of(trade, "result_r")) < 0]
        total_loss = round(sum(as_float(value_of(trade, "result_r")) for trade in losses), 2)
        rows.append(
            {
                "mistake_type": mistake,
                "count": len(group),
                "frequency": _rate(len(group), len(trades)),
                "losses": len(losses),
                "loss_r": total_loss,
                "win_rate": _rate(sum(1 for trade in group if as_str(value_of(trade, "result")) == "TP1"), len(group)),
                "average_r": round(sum(as_float(value_of(trade, "result_r")) for trade in group) / len(group), 2),
            }
        )

    return {
        "top_mistakes": sorted(rows, key=lambda row: row["count"], reverse=True)[:8],
        "mistake_frequency": sorted(rows, key=lambda row: row["frequency"], reverse=True),
        "losses_by_mistake_type": sorted(rows, key=lambda row: row["loss_r"])[:8],
        "win_rate_by_mistake_type": sorted(rows, key=lambda row: row["win_rate"], reverse=True),
        "most_expensive_mistakes": sorted(rows, key=lambda row: row["loss_r"])[:5],
    }

