# Data Policy

Last updated: 2026-06-07

## Purpose

This policy defines how Fabio Edge Research Lab classifies, stores, audits, and
uses data. It applies to trading records, broker CSV imports, investment data,
caches, manual inputs, analytics, simulations, scores, and future research
models.

The governing rule is simple: missing or uncertain data must never look more
reliable than it is.

## Data Source Classes

Every material input should use one of these source classes:

| Source class | Meaning | Scoring use |
| --- | --- | --- |
| Real | Parsed directly from an identified external or stored primary source | Allowed when valid and current |
| Cache | Previously fetched real data with source and freshness metadata | Allowed while fresh and structurally valid |
| Manual | Explicit user input | Allowed, but must remain labelled manual |
| Derived | Deterministic calculation from identified inputs | Allowed when its input lineage is available |
| Fallback | Substitute or default used because preferred data is unavailable | Penalized or excluded according to the model |
| Missing | No usable value | Never replaced silently |

A value may have both a storage source and an origin. For example, cached SEC
data remains SEC-origin data with cache status attached.

## Required Audit Metadata

Material fields and pipeline outputs should expose:

- Source provider and source class.
- Source field or concept where available.
- Retrieval or user-entry timestamp.
- Cache status and freshness.
- Raw value and normalized value when transformation occurs.
- Missing, empty, failed, blocked, or malformed status.
- Whether a fallback was used.
- Whether the value affected a score, model, rank, or validity decision.
- Confidence or reliability impact.

Derived values should identify the inputs and formula version used.

## Missing and Fallback Data

- Do not silently replace missing data with a neutral-looking score.
- Do not persist HTTP errors, empty arrays, or malformed bodies as valid data.
- Empty and failed cache entries may be repaired or refetched when the endpoint
  is available and quota permits.
- Premium-blocked endpoint memory should be preserved so calls are not wasted.
- Rankings must separate reliable candidates from incomplete-data candidates.
- Missing risk data must not cause a stock to rank as lowest or highest risk.
- Missing stop loss must produce a blank R value, not `0R`.

When fallback inputs are permitted, the UI must show their contribution and
reduce confidence according to the model's documented rules.

## Trading Data Eligibility

Trading records are preserved even when incomplete. Research eligibility is a
separate decision.

For core trading analytics, Monte Carlo, and future models:

- The record must represent a taken trade.
- `data_quality` must be `good`.
- Result and result R must be valid for any R-based calculation.
- Required grouping fields must be present for the requested segment.
- Imported records remain incomplete until the required review fields are
  supplied.

Skipped, watched, invalidated, incomplete, and bad records remain useful for
selection-bias and process research, but they must not silently enter taken
trade performance metrics.

Tradovate and other broker CSV imports are historical imports only. Original
broker symbol, normalized symbol, transaction order, timestamps, prices, PnL,
duplicate identity, and validation warnings should remain traceable.

## Investment Data Eligibility

Investment data may come from:

- Local ticker universes.
- Financial Modeling Prep endpoints available to the user's plan.
- SEC EDGAR XBRL company facts.
- Fresh local caches.
- Explicit manual input.

Scenario and valuation eligibility must not be granted when required price,
share count, cash flow, historical, or statement data is absent. Sector-specific
exceptions must be visible, especially where traditional FCF DCF is unsuitable.

FMP rules:

- Respect the official quota as the source of truth.
- Include attempted and failed requests in local diagnostics.
- Never request an endpoint remembered as premium blocked.
- Treat empty, failed, stale, and valid caches differently.
- Do not commit cached API responses.

SEC rules:

- Send the configured descriptive User-Agent.
- Use conservative request pacing.
- Cache ticker-to-CIK mappings and company facts.
- Prefer annual USD 10-K facts where required by the extraction logic.
- Record the XBRL concepts, fiscal periods, and any sign normalization used.
- Treat ambiguous or missing concepts as uncertain, not as zero.

## Model and Recommendation Gates

A model may produce a decision-support output only when:

- Required inputs are present and pass structural validation.
- The input source mix and reliability are visible.
- Assumptions are explicit.
- The sample size or coverage is shown.
- Uncertainty and known limitations are shown.

Low coverage, fallback-heavy inputs, or strong valuation disagreement must
reduce confidence. Insufficient data must be labelled `Insufficient Data`
rather than `Avoid`, because absence of evidence is not a negative signal.

Research labels, allocation ranges, and risk levels are not financial advice or
order recommendations.

## Cache and Freshness

Cache records should be classified as:

- Valid data cache.
- Empty cache.
- Failed cache.
- Premium-blocked cache.
- Stale cache.

Freshness must be defined by provider and endpoint. Cache repair may remove
empty and failed entries while retaining valid data, premium-blocked memory,
SEC FCF data, and user-entered data.

## Privacy and Secret Handling

Never commit:

- `.env` or `.env.local`.
- FMP keys, tokens, credentials, or personal SEC contact values.
- Raw broker CSV files.
- Browser storage exports containing trading, portfolio, or account data.
- API response caches.
- Screenshots containing account identifiers.
- Logs containing secrets or private records.

Use `.env.example` placeholders only. Run the repository secret check before
every pull request.

## Storage and Portability

- Browser localStorage is local to a browser profile and is not shared
  automatically with collaborators.
- PostgreSQL and local fallback records must preserve backward compatibility
  when schemas evolve.
- Imports should be idempotent where deterministic duplicate identifiers exist.
- Research exports should include enough filters, assumptions, and sample
  information to explain the result.
- Cloud synchronization remains a future interface, not an active data path.

## Policy for New Data Pipelines

Before a new provider or model is implemented, document:

1. The research question.
2. The input fields and source.
3. Terms, quota, authentication, and cache behavior.
4. Missing-data and failure behavior.
5. Normalization and derived calculations.
6. Eligibility and confidence rules.
7. Audit output.
8. Parser or model tests.
9. Research-only and safety boundaries.
