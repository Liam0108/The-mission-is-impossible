BEGIN;

ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_version VARCHAR(32);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS setup_score INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS screenshot_tags TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS screenshot_favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS screenshot_bookmarked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS screenshot_notes TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS lessons_learned TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS followed_plan VARCHAR(16) NOT NULL DEFAULT 'Yes';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS mistake_type VARCHAR(32) NOT NULL DEFAULT 'None';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS discipline_score INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS execution_score INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS emotion_score INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS daily_bias VARCHAR(8) NOT NULL DEFAULT 'Neutral';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS weekly_bias VARCHAR(8) NOT NULL DEFAULT 'Neutral';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS monthly_bias VARCHAR(8) NOT NULL DEFAULT 'Neutral';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS high_impact_news VARCHAR(3) NOT NULL DEFAULT 'No';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS news_type VARCHAR(24);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS news_timing VARCHAR(16) NOT NULL DEFAULT 'No News';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_trades_session'
          AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades DROP CONSTRAINT ck_trades_session;
    END IF;

    ALTER TABLE trades
        ADD CONSTRAINT ck_trades_session
        CHECK (
            session IN (
                'Asian',
                'London',
                'NY_AM',
                'NY_PM',
                'NY_Open',
                'NY_Power_Hour',
                'NY_Lunch',
                'Asian_Early',
                'Asian_Late',
                'London_Open',
                'London_Mid'
            )
        );
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_setup_score' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_setup_score CHECK (setup_score IS NULL OR setup_score BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_followed_plan' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_followed_plan CHECK (followed_plan IN ('Yes', 'Partially', 'No'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_mistake_type' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_mistake_type CHECK (
            mistake_type IN (
                'None',
                'Early Entry',
                'Late Entry',
                'FOMO',
                'No Stop',
                'Moved Stop',
                'Ignored Bias',
                'Ignored Risk',
                'Overtrading',
                'Revenge Trading',
                'Emotional Trade',
                'Other'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_discipline_score' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_discipline_score CHECK (discipline_score IS NULL OR discipline_score BETWEEN 1 AND 10);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_execution_score' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_execution_score CHECK (execution_score IS NULL OR execution_score BETWEEN 1 AND 10);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_emotion_score' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_emotion_score CHECK (emotion_score IS NULL OR emotion_score BETWEEN 1 AND 10);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_daily_bias' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_daily_bias CHECK (daily_bias IN ('Bullish', 'Bearish', 'Neutral'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_weekly_bias' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_weekly_bias CHECK (weekly_bias IN ('Bullish', 'Bearish', 'Neutral'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_monthly_bias' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_monthly_bias CHECK (monthly_bias IN ('Bullish', 'Bearish', 'Neutral'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_high_impact_news' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_high_impact_news CHECK (high_impact_news IN ('Yes', 'No'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_news_type' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_news_type CHECK (
            news_type IS NULL OR news_type IN ('CPI', 'FOMC', 'NFP', 'PCE', 'GDP', 'Retail Sales', 'Jobless Claims', 'Other')
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_trades_news_timing' AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT ck_trades_news_timing CHECK (news_timing IN ('Before News', 'During News', 'After News', 'No News'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_trades_strategy_version ON trades (strategy_version);
CREATE INDEX IF NOT EXISTS ix_trades_mistake_type ON trades (mistake_type);
CREATE INDEX IF NOT EXISTS ix_trades_news_timing ON trades (news_timing);
CREATE INDEX IF NOT EXISTS ix_trades_daily_bias ON trades (daily_bias);
CREATE INDEX IF NOT EXISTS ix_trades_weekly_bias ON trades (weekly_bias);
CREATE INDEX IF NOT EXISTS ix_trades_monthly_bias ON trades (monthly_bias);
CREATE INDEX IF NOT EXISTS ix_trades_setup_score ON trades (setup_score);

COMMIT;

