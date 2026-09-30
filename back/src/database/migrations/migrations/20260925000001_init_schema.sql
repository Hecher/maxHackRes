-- +goose Up
-- +goose StatementBegin

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    max_user_id BIGINT NOT NULL UNIQUE,
    username TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
    city TEXT,
    school TEXT,
    class_number SMALLINT,
    subject TEXT,
    token_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_student_links (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(teacher_id, student_id)
);

CREATE TABLE labs (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
    math_model JSONB NOT NULL,
    scene JSONB,
    noise_percent NUMERIC,
    max_rows SMALLINT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attempts (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_id BIGINT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('test', 'work')),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'finished')),
    rng_seed BIGINT,
    result_data JSONB,
    grade SMALLINT,
    comment TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);


CREATE INDEX idx_teacher_student_links_teacher_id ON teacher_student_links(teacher_id);
CREATE INDEX idx_teacher_student_links_student_id ON teacher_student_links(student_id);
CREATE INDEX idx_labs_author_id ON labs(author_id);
CREATE INDEX idx_attempts_student_id ON attempts(student_id);
CREATE INDEX idx_attempts_lab_id ON attempts(lab_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS attempts;
DROP TABLE IF EXISTS labs;
DROP TABLE IF EXISTS teacher_student_links;
DROP TABLE IF EXISTS users;

-- +goose StatementEnd