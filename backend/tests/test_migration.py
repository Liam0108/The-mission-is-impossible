from pathlib import Path


MIGRATIONS = Path(__file__).resolve().parents[1] / "app" / "db" / "migrations"


def test_migration_is_additive_and_preserves_existing_data():
    sql = (MIGRATIONS / "002_trade_research_upgrade.sql").read_text()

    assert "ADD COLUMN IF NOT EXISTS trade_decision" in sql
    assert "ADD COLUMN IF NOT EXISTS user_id" in sql
    assert "ADD COLUMN IF NOT EXISTS workspace_id" in sql
    assert "DROP TABLE" not in sql.upper()
    assert "DELETE FROM trades" not in sql


def test_phase3_migration_is_additive():
    sql = (MIGRATIONS / "003_phase3_research_upgrade.sql").read_text()

    assert "ADD COLUMN IF NOT EXISTS strategy_version" in sql
    assert "ADD COLUMN IF NOT EXISTS followed_plan" in sql
    assert "ADD COLUMN IF NOT EXISTS high_impact_news" in sql
    assert "DROP TABLE" not in sql.upper()
    assert "DELETE FROM trades" not in sql


def test_trade_logger_field_clarity_migration_is_additive():
    sql = (MIGRATIONS / "006_trade_logger_field_clarity.sql").read_text()

    assert "ADD COLUMN IF NOT EXISTS manual_quality" in sql
    assert "DROP TABLE" not in sql.upper()
    assert "DELETE FROM trades" not in sql
    assert "'PDH/PDL'" in sql
    assert "'HL for Long'" in sql


def test_setup_type_edge_lab_v2_migration_is_additive():
    sql = (MIGRATIONS / "008_setup_type_edge_lab_v2.sql").read_text()

    assert "ADD COLUMN IF NOT EXISTS setup_type" in sql
    assert "CREATE INDEX IF NOT EXISTS ix_trades_setup_type" in sql
    assert "DROP TABLE" not in sql.upper()
    assert "DELETE FROM trades" not in sql
    assert "'Fabio Long'" in sql
    assert "'Sweep Reversal Short'" in sql


def test_broker_trade_import_migration_is_additive():
    sql = (MIGRATIONS / "009_broker_trade_import_v1.sql").read_text()

    assert "ADD COLUMN IF NOT EXISTS account" in sql
    assert "ADD COLUMN IF NOT EXISTS imported" in sql
    assert "ADD COLUMN IF NOT EXISTS review_status" in sql
    assert "CREATE INDEX IF NOT EXISTS ix_trades_broker_trade_id" in sql
    assert "DROP TABLE" not in sql.upper()
    assert "DELETE FROM trades" not in sql
    assert "'unreviewed'" in sql
    assert "'reviewed'" in sql
