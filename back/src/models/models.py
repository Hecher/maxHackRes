from sqlalchemy import BigInteger, ForeignKey, SmallInteger, Text, Boolean, Numeric, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.database.base import Base, IdentityMixin, TimestampMixin
from datetime import datetime

class Classroom(Base, IdentityMixin, TimestampMixin):
    __tablename__ = "classrooms"
    __table_args__ = (UniqueConstraint('school', 'grade', name='uq_classroom_school_grade'),)

    school: Mapped[str] = mapped_column(Text, nullable=False)
    grade: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class User(Base, IdentityMixin, TimestampMixin):
    __tablename__ = "users"

    max_user_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    username: Mapped[str | None] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str | None] = mapped_column(Text)
    school: Mapped[str | None] = mapped_column(Text)
    class_number: Mapped[int | None] = mapped_column(SmallInteger)

    classroom_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("classrooms.id", ondelete="SET NULL")
    )
    subject: Mapped[str | None] = mapped_column(Text)
    token_hash: Mapped[str | None] = mapped_column(Text)


class TeacherStudentLink(Base, IdentityMixin, TimestampMixin):
    __tablename__ = "teacher_student_links"
    __table_args__ = (UniqueConstraint('teacher_id', 'student_id', name='uq_teacher_student'),)

    teacher_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


class LabAssignment(Base, IdentityMixin, TimestampMixin):
    __tablename__ = "lab_assignments"
    __table_args__ = (UniqueConstraint('lab_id', 'classroom_id', name='uq_lab_classroom'),)

    lab_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("labs.id", ondelete="CASCADE"), nullable=False)
    classroom_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False
    )


class Component(Base, IdentityMixin, TimestampMixin):
    __tablename__ = "components"

    author_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    graph: Mapped[dict] = mapped_column(JSONB, nullable=False)


class Lab(Base, IdentityMixin, TimestampMixin):
    __tablename__ = "labs"

    author_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str | None] = mapped_column(Text)

    summary: Mapped[str | None] = mapped_column(Text)
    goal: Mapped[str | None] = mapped_column(Text)

    guide: Mapped[str | None] = mapped_column(Text)
    guide_file: Mapped[str | None] = mapped_column(Text)
    guide_file_name: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(Text, nullable=False)
    math_model: Mapped[dict] = mapped_column(JSONB, nullable=False)
    scene: Mapped[dict | None] = mapped_column(JSONB)

    journal_columns: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )

    assigned_class_ids: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    noise_percent: Mapped[float | None] = mapped_column(Numeric)
    max_rows: Mapped[int | None] = mapped_column(SmallInteger)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Attempt(Base, IdentityMixin):
    __tablename__ = "attempts"

    student_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lab_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("labs.id", ondelete="CASCADE"), nullable=False)
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    rng_seed: Mapped[int | None] = mapped_column(BigInteger)
    result_data: Mapped[dict | None] = mapped_column(JSONB)
    grade: Mapped[int | None] = mapped_column(SmallInteger)
    comment: Mapped[str | None] = mapped_column(Text)

    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)