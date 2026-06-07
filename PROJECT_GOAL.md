# Fabio Edge Research Lab: Project Goal

Last updated: 2026-06-07

## Mission

Fabio Edge Research Lab is a research-first decision-support system for
discretionary trading and long-term investing.

Its purpose is to help the user determine whether an idea has measurable
statistical or valuation support. It should make probability, expected value,
risk, data quality, valuation assumptions, and portfolio quality easier to
understand and audit.

The system supports decisions. It does not make decisions or execute trades for
the user.

## What This Project Is

- A data-driven trading and investment research lab.
- A strategy validation and trade review system.
- An edge measurement platform for historical trading results.
- An investment valuation lab using free or low-cost data sources.
- A mathematical research environment with explicit data-quality gates.
- A local-first application that preserves source and assumption transparency.

## What This Project Is Not

- A live trading bot.
- An automated order execution system.
- A broker-connected execution platform.
- A signal-selling service.
- A guaranteed-return or financial-advice product.
- A simple manual journal with no research layer.
- A simple stock screener that hides assumptions or missing data.

## Trading Research Direction

The trading side should answer questions such as:

- Does the Fabio / order-flow / ICT-style strategy have a measurable edge?
- Which setups, sessions, regimes, symbols, and directions perform best?
- How do execution mistakes change expectancy and drawdown?
- What happens to results under different trade-management rules?
- How much historical evidence supports a conclusion?

The priority workflow is:

1. Import completed trades from broker or platform CSV files.
2. Review and complete the imported records.
3. Calculate stop-based R multiples only when the required inputs exist.
4. Tag setup, session, market regime, quality, mistakes, and notes.
5. Measure expectancy, win rate, average R, profit factor, drawdown, and
   Monte Carlo outcomes.
6. Compare results by setup and market condition.

Broker CSV import is historical data ingestion only. The trading side must not
add broker connectivity, live trading, order execution, automatic trading, or
prediction models before the historical dataset is clean and suitable.

## Investment Research Direction

The investment side should answer questions such as:

- Is the underlying data complete and reliable enough for valuation?
- What do DCF, normalized FCF, reverse DCF, and scenario models imply?
- Which assumptions are required to justify the current market price?
- How sensitive is fair value to growth, discount rate, and cash-flow inputs?
- Does a stock improve or weaken a research portfolio's diversification?

The data pipeline combines:

- Local stock universes.
- Financial Modeling Prep data that is available under the user's plan.
- SEC EDGAR XBRL company facts.
- Fresh local cache data.
- Explicit manual inputs.

Every conclusion must distinguish real, cached, manual, fallback, and missing
data. The Investment Lab must not present a confident recommendation when the
input coverage or model agreement is weak.

## Mathematical Research Direction

Useful research models include:

- Expectancy and R-multiple distributions.
- Profit factor and break-even win rate.
- Drawdown and risk-of-ruin estimates.
- Monte Carlo simulations.
- Reverse DCF and probability-weighted scenarios.
- Portfolio allocation and concentration research.
- Kelly-style sizing as research only.

Advanced models such as GARCH, Hawkes processes, Almgren-Chriss execution
models, Kyle impact models, and order-flow models are long-term possibilities.
They may be considered only when their required market or order-flow inputs are
available, clean, auditable, and validated.

## Data-First Principles

- Data quality is more important than feature count.
- Missing data must remain visibly missing.
- Fake or silent defaults are prohibited.
- Every pipeline must expose source, timestamp, cache status, missing fields,
  fallback use, confidence, and scoring eligibility.
- Only eligible records may enter analytics, simulations, or future models.
- Research outputs must explain assumptions, limitations, and sample size.
- Raw inputs and transformations must be traceable enough to reproduce results.

Detailed rules are defined in [DATA_POLICY.md](DATA_POLICY.md).

## Success Criteria

The project is succeeding when it helps the user:

- Complete and trust a historical trading dataset.
- Identify which trading behaviors have positive or negative expected value.
- Separate real edge from small-sample noise.
- Understand drawdown and management-rule tradeoffs before changing behavior.
- Audit investment data before trusting a score or valuation.
- Compare valuation scenarios without hiding assumptions.
- Build research conclusions that can be reproduced and challenged.

## Permanent Safety Boundaries

- No live broker connection.
- No order placement or execution.
- No automatic trading.
- No guaranteed-return or financial-advice language.
- No removal of research-only warnings.
- No ML training until clean historical data and an explicit implementation
  request justify it.
- No Market Lab changes unless the request explicitly targets Market Lab.
- No committed API keys, account data, broker CSV files, caches, or user data.
