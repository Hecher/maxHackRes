-- +goose Up
-- +goose StatementBegin

ALTER TABLE labs
    ADD COLUMN IF NOT EXISTS guide_file TEXT,
    ADD COLUMN IF NOT EXISTS guide_file_name TEXT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE labs
    DROP COLUMN IF EXISTS guide_file,
    DROP COLUMN IF EXISTS guide_file_name;

-- +goose StatementEnd
