-- +goose Up
-- +goose StatementBegin

ALTER TABLE labs
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS goal TEXT,
    ADD COLUMN IF NOT EXISTS guide TEXT,
    ADD COLUMN IF NOT EXISTS journal_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS assigned_class_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE labs
    DROP COLUMN IF EXISTS summary,
    DROP COLUMN IF EXISTS goal,
    DROP COLUMN IF EXISTS guide,
    DROP COLUMN IF EXISTS journal_columns,
    DROP COLUMN IF EXISTS assigned_class_ids;

-- +goose StatementEnd
