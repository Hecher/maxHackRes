from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    max_user_id: int
    full_name: str
    role: Literal["student", "teacher"]
    city: str | None = None
    school: str | None = None
    class_number: int | None = None
    subject: str | None = None

class UserResponse(UserCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LinkCreate(BaseModel):
    student_max_user_id: int

class LinkResponse(BaseModel):
    student_id: int
    max_user_id: int
    full_name: str
    class_number: int | None = None
    school: str | None = None


class ClassroomCreate(BaseModel):
    school: str | None = None
    grade: int

class ClassroomResponse(BaseModel):
    id: int
    school: str
    grade: int
    label: str
    students_count: int = 0
    model_config = ConfigDict(from_attributes=True)

class AssignRequest(BaseModel):
    classroom_ids: list[int] = Field(default_factory=list)


class ComponentCreate(BaseModel):
    name: str
    graph: dict[str, Any]

class ComponentResponse(BaseModel):
    id: int
    name: str
    graph: dict[str, Any]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LabCreate(BaseModel):
    title: str
    subject: str | None = None
    summary: str | None = None
    goal: str | None = None
    guide: str | None = None
    guide_file: str | None = None
    guide_file_name: str | None = None
    visibility: Literal["public", "private"] = "private"
    math_model: dict[str, Any]
    scene: dict[str, Any] | None = None
    journal_columns: list[dict[str, Any]] = Field(default_factory=list)
    assigned_class_ids: list[str] = Field(default_factory=list)
    noise_percent: float | None = None
    max_rows: int | None = None
    is_published: bool = False

class LabResponse(LabCreate):
    id: int
    author_id: int
    created_at: datetime

    author_name: str | None = None
    model_config = ConfigDict(from_attributes=True)

class LabUpdate(BaseModel):
    title: str | None = None
    subject: str | None = None
    summary: str | None = None
    goal: str | None = None
    guide: str | None = None
    guide_file: str | None = None
    guide_file_name: str | None = None
    visibility: Literal["public", "private"] | None = None
    math_model: dict[str, Any] | None = None
    scene: dict[str, Any] | None = None
    journal_columns: list[dict[str, Any]] | None = None
    assigned_class_ids: list[str] | None = None
    noise_percent: float | None = None
    max_rows: int | None = None
    is_published: bool | None = None



class Measurement(BaseModel):
    step: int
    inputs: dict[str, float]
    outputs: dict[str, float]

class AttemptResultData(BaseModel):
    measurements: list[Measurement] = Field(default_factory=list)
    answers: dict[str, Any] = Field(default_factory=dict)
    client_metrics: dict[str, Any] = Field(default_factory=dict)

class AttemptCreate(BaseModel):
    lab_id: int
    mode: Literal["test", "work"]

class AttemptFinishRequest(BaseModel):

    grade: int | None = None
    result_data: AttemptResultData | None = None
    comment: str | None = None

class AttemptResponse(BaseModel):
    id: int
    student_id: int
    lab_id: int
    mode: str
    status: str
    result_data: AttemptResultData | dict[str, Any] | None = None
    grade: int | None = None
    comment: str | None = None
    started_at: datetime
    finished_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

class AttemptReviewRequest(BaseModel):
    grade: int | None = None
    comment: str | None = None

class AttemptListItem(AttemptResponse):
    lab_title: str
    student_name: str
    class_number: int | None = None



class AuthRequest(BaseModel):
    initData: str
    role: str = "student"

class ProfileUpdate(BaseModel):
    full_name: str | None = None
    city: str | None = None
    school: str | None = None
    class_number: int | None = None
    subject: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool
    user: UserResponse