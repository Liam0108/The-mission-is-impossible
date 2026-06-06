from typing import Any

from app.services.normalization import as_float, as_str, value_of


def grade_for_score(score: int) -> str:
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    return "Avoid"


def calculate_setup_score(setup: Any, probability: dict[str, Any] | None = None) -> dict[str, Any]:
    return calculate_setup_score_v2(setup, probability)


def _present_structure(value: str) -> bool:
    return value not in {"", "None", "No", "Unknown"}


def _base_rule_score(setup: Any) -> tuple[int, list[dict[str, Any]]]:
    score = 50
    components: list[dict[str, Any]] = [
        {"label": "Base quality", "points": 50, "reason": "Neutral starting score before setup evidence."}
    ]

    direction = as_str(value_of(setup, "direction"))
    bias = as_str(value_of(setup, "bias_15m")).strip()
    market_state = as_str(value_of(setup, "market_state"))
    location = as_str(value_of(setup, "location"))
    liquidity_sweep = as_str(value_of(setup, "liquidity_sweep"))
    choch = as_str(value_of(setup, "choch"))
    lh_hl = as_str(value_of(setup, "lh_hl"))
    fvg_reaction = as_str(value_of(setup, "fvg_reaction"))
    volume_state = as_str(value_of(setup, "volume_state"))
    planned_rr = value_of(setup, "planned_rr")

    if bias.lower() == direction.lower():
        score += 15
        components.append({"label": "15m bias alignment", "points": 15, "reason": "Setup direction matches trader bias."})
    elif bias.lower() in {"neutral", "mixed"}:
        components.append({"label": "15m bias alignment", "points": 0, "reason": "Bias is neutral or mixed."})
    else:
        score -= 10
        components.append({"label": "15m bias conflict", "points": -10, "reason": "Setup direction conflicts with trader bias."})

    if _present_structure(liquidity_sweep):
        score += 15
        components.append({"label": "Liquidity sweep", "points": 15, "reason": f"Liquidity sweep is present on {liquidity_sweep}."})

    if _present_structure(choch):
        score += 10
        components.append({"label": "CHOCH", "points": 10, "reason": f"Change of character is present on {choch}."})

    if lh_hl == "Yes" or (direction == "Long" and lh_hl == "HL for Long") or (direction == "Short" and lh_hl == "LH for Short"):
        score += 10
        components.append({"label": "Entry pullback structure", "points": 10, "reason": f"{lh_hl} supports the entry direction."})
    elif lh_hl in {"Failed HL", "Failed LH"}:
        score -= 10
        components.append({"label": "Entry pullback structure", "points": -10, "reason": f"{lh_hl} weakens entry structure."})

    fvg_points = {"Strong": 10, "Medium": 5, "Weak": 0, "None": -5}.get(fvg_reaction, 0)
    score += fvg_points
    components.append({"label": "FVG reaction", "points": fvg_points, "reason": f"{fvg_reaction or 'Unknown'} FVG reaction."})

    volume_points = {"High": 5, "Normal": 2, "Low": -3}.get(volume_state, 0)
    score += volume_points
    components.append({"label": "Volume state", "points": volume_points, "reason": f"{volume_state or 'Unknown'} volume context."})

    if location in {"VAH", "VAL"}:
        score += 10
        components.append({"label": "Value area edge", "points": 10, "reason": "Setup is at VAH/VAL."})
    elif location == "POC":
        score -= 20
        components.append({"label": "Inside POC zone", "points": -20, "reason": "POC can reduce location quality."})
    elif location in {"PDH", "PDL", "EQH", "EQL"}:
        score += 5
        components.append({"label": "External liquidity", "points": 5, "reason": "Setup is near a prior high/low or equal high/low."})

    if market_state == "Balanced":
        score -= 10
        components.append({"label": "Balanced market", "points": -10, "reason": "Balanced markets can reduce directional follow-through."})

    if planned_rr is not None and float(planned_rr) < 1.5:
        score -= 15
        components.append({"label": "Poor RR", "points": -15, "reason": "Planned reward/risk is below 1.5R."})

    return max(0, min(100, int(round(score)))), components


def _historical_edge(probability: dict[str, Any] | None) -> int:
    if not probability:
        return 0
    tp1 = as_float(probability.get("tp1_probability"))
    sl = as_float(probability.get("sl_probability"))
    average_r = as_float(probability.get("historical", {}).get("average_rr"))
    if tp1 >= 65 and average_r > 0.75:
        return 12
    if tp1 >= 55 and average_r > 0.25:
        return 7
    if sl >= 45 or average_r < 0:
        return -12
    return 0


def _regime_score(setup: Any) -> int:
    regime = as_str(value_of(setup, "regime_label"))
    direction = as_str(value_of(setup, "direction"))
    if not regime:
        return 0
    if (regime == "Trend Up" and direction == "Long") or (regime == "Trend Down" and direction == "Short"):
        return 8
    if regime == "Expansion":
        return 6
    if regime in {"Balanced", "Choppy"}:
        return -8
    if regime == "POC Chop":
        return -14
    if regime == "News Driven":
        return -10
    return 0


def _poc_penalty(setup: Any) -> int:
    location = as_str(value_of(setup, "location"))
    risk = as_str(value_of(setup, "poc_risk_level"))
    distance = value_of(setup, "distance_to_poc")
    if location == "POC" or risk == "High":
        return -18
    if distance is not None and as_float(distance) <= 5:
        return -12
    if risk == "Medium":
        return -6
    return 0


def _news_penalty(setup: Any) -> int:
    if as_str(value_of(setup, "high_impact_news")) == "Yes":
        return -12
    timing = as_str(value_of(setup, "news_timing"))
    if timing == "During News":
        return -15
    if timing in {"Before News", "After News"}:
        return -6
    return 0


def _confidence_adjustment(probability: dict[str, Any] | None) -> int:
    if not probability:
        return 0
    sample_size = int(as_float(probability.get("sample_size")))
    if sample_size >= 30:
        return 5
    if sample_size >= 10:
        return 0
    return -8


def _recommended_risk(score: int, sl_probability: float, poc_penalty: int, news_penalty: int) -> str:
    if score < 60 or sl_probability >= 45 or news_penalty <= -12 or poc_penalty <= -18:
        return "no trade"
    if score < 75 or sl_probability >= 30 or poc_penalty < 0 or news_penalty < 0:
        return "half risk"
    return "full risk"


def calculate_setup_score_v2(setup: Any, probability: dict[str, Any] | None = None) -> dict[str, Any]:
    base_score, components = _base_rule_score(setup)
    historical_edge_score = _historical_edge(probability)
    market_regime_score = _regime_score(setup)
    poc_risk_penalty = _poc_penalty(setup)
    news_risk_penalty = _news_penalty(setup)
    data_confidence_adjustment = _confidence_adjustment(probability)
    score = max(
        0,
        min(
            100,
            base_score
            + historical_edge_score
            + market_regime_score
            + poc_risk_penalty
            + news_risk_penalty
            + data_confidence_adjustment,
        ),
    )

    additions = [
        ("Historical edge", historical_edge_score, "Similar historical outcomes adjusted this setup."),
        ("Market regime", market_regime_score, "Manual regime label adjusted directional quality."),
        ("POC risk", poc_risk_penalty, "POC proximity and risk level adjusted quality."),
        ("News risk", news_risk_penalty, "High-impact news timing adjusted quality."),
        ("Data confidence", data_confidence_adjustment, "Historical sample size adjusted confidence."),
    ]
    for label, points, reason in additions:
        if points:
            components.append({"label": label, "points": points, "reason": reason})

    sl_probability = as_float(probability.get("sl_probability")) if probability else 0.0
    average_r = as_float(probability.get("historical", {}).get("average_rr")) if probability else 0.0
    recommended = _recommended_risk(score, sl_probability, poc_risk_penalty, news_risk_penalty)
    notes = [
        f"Base rule score: {base_score}.",
        f"Historical edge adjustment: {historical_edge_score}.",
        f"Market regime adjustment: {market_regime_score}.",
        f"POC/news adjustment: {poc_risk_penalty + news_risk_penalty}.",
        f"Recommended risk level: {recommended}.",
    ]

    return {
        "setup_score": int(round(score)),
        "trade_grade": grade_for_score(int(round(score))),
        "base_score": base_score,
        "historical_edge_score": historical_edge_score,
        "market_regime_score": market_regime_score,
        "poc_risk_penalty": poc_risk_penalty,
        "news_risk_penalty": news_risk_penalty,
        "data_confidence_adjustment": data_confidence_adjustment,
        "score_components": components,
        "average_r": average_r,
        "recommended_risk_level": recommended,
        "explanation_notes": notes,
    }
