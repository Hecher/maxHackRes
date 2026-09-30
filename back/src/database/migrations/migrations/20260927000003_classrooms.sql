-- +goose Up
-- +goose StatementBegin

CREATE TABLE classrooms (
    id BIGSERIAL PRIMARY KEY,
    school TEXT NOT NULL,
    grade SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school, grade)
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS classroom_id BIGINT REFERENCES classrooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_classroom_id ON users(classroom_id);

CREATE TABLE lab_assignments (
    id BIGSERIAL PRIMARY KEY,
    lab_id BIGINT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    classroom_id BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lab_id, classroom_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_assignments_lab_id ON lab_assignments(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_assignments_classroom_id ON lab_assignments(classroom_id);

INSERT INTO classrooms (school, grade)
SELECT DISTINCT school, class_number
FROM users
WHERE role = 'student' AND school IS NOT NULL AND class_number IS NOT NULL
ON CONFLICT (school, grade) DO NOTHING;

UPDATE users u
SET classroom_id = c.id
FROM classrooms c
WHERE u.role = 'student'
  AND u.classroom_id IS NULL
  AND u.school = c.school
  AND u.class_number = c.grade;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS lab_assignments;
ALTER TABLE users DROP COLUMN IF EXISTS classroom_id;
DROP TABLE IF EXISTS classrooms;

-- +goose StatementEnd
