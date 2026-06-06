# Development Roadmap

## Phase 1: MVP

- Trade CRUD with strict allowed values
- CSV import/export
- Screenshot upload
- Dashboard statistics
- Rule-based setup scoring
- Historical frequency probability engine
- Similar trade comparison
- No Trade records to reduce selection bias
- POC risk filtering
- TP1 management rule lab
- Local language selector for English, Chinese, and Japanese

## Phase 2: Research Depth

- Advanced filters across dashboard panels
- Trade management reports
- Stop-placement analysis
- TP2 strategy comparison
- Exportable PDF/CSV research reports
- Bulk screenshot organization
- Screenshot Library
- Review System
- Daily Trading Score
- Market Context and News Filter
- Strategy Version Control
- Edge Discovery Engine

## Phase 3: ML Architecture Activation

Machine learning remains disabled until at least 300 valid taken trades exist.

Candidate models:

- Logistic Regression
- Random Forest
- XGBoost

ML outputs must remain decision-support probabilities. They must not create entries, exits, or order instructions.

## Phase 4: Integrations

Future integrations are isolated behind adapters:

- TradingView chart context import
- Broker read-only trade import
- Screenshot metadata extraction
- Voice note transcription
- Order-flow and volume-profile data imports

No integration may place orders.

## Phase 5: Team/Journal Quality

- Review workflows
- Mistake tagging
- Weekly scorecards
- Personal playbook generation
- Setup templates
