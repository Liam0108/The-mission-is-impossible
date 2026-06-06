# ML Architecture

Machine learning is intentionally disabled.

Activation rule:

- At least 300 valid taken trades are required.
- Valid trades must have `trade_decision = Taken`.
- Future target: predict whether TP1 is reached before SL.

Future candidate models:

- Logistic Regression
- Random Forest
- XGBoost

Feature set:

- session
- direction
- bias_15m
- market_state
- location
- liquidity_sweep
- choch
- lh_hl
- fvg_reaction
- volume_state
- rr_ratio
- distance_to_poc
- distance_to_vah
- distance_to_val
- poc_risk_level

No model may place trades or generate execution instructions.

