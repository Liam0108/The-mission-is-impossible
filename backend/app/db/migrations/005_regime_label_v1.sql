ALTER TABLE trades ADD COLUMN IF NOT EXISTS regime_label VARCHAR(24);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_regime_label' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_regime_label
        CHECK (
            regime_label IS NULL OR regime_label IN (
                'Trend Up',
                'Trend Down',
                'Balanced',
                'Expansion',
                'Choppy',
                'News Driven',
                'POC Chop'
            )
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_trades_regime_label ON trades (regime_label);
