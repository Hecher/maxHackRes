import hashlib
import hmac
from urllib.parse import urlencode

import jwt
import pytest
from pydantic import ValidationError

from src.core.config import settings
from src.core.security import create_access_token, validate_init_data
from src.schemas.schemas import AttemptFinishRequest, ClassroomCreate, LabCreate

def sign_init_data(fields: dict[str, str], bot_token: str) -> str:
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret_key = hmac.new(key=b"WebAppData", msg=bot_token.encode(), digestmod=hashlib.sha256).digest()
    signature = hmac.new(key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256).hexdigest()

    payload = dict(fields)
    payload["hash"] = signature
    return urlencode(payload)

class TestInitData:
    def test_valid_signature_returns_user(self):
        fields = {"auth_date": "1700000000", "user": '{"id": 42, "first_name": "Иван"}'}
        raw = sign_init_data(fields, settings.BOT_TOKEN)

        user = validate_init_data(raw, settings.BOT_TOKEN)

        assert user is not None
        assert user["id"] == 42

    def test_foreign_token_is_rejected(self):
        fields = {"auth_date": "1700000000", "user": '{"id": 42}'}
        raw = sign_init_data(fields, "другой_токен")

        assert validate_init_data(raw, settings.BOT_TOKEN) is None

    def test_tampered_payload_is_rejected(self):
        fields = {"auth_date": "1700000000", "user": '{"id": 42}'}
        raw = sign_init_data(fields, settings.BOT_TOKEN)
        tampered = raw.replace("42", "43")

        assert validate_init_data(tampered, settings.BOT_TOKEN) is None

    def test_missing_hash_is_rejected(self):
        assert validate_init_data("auth_date=1700000000&user=%7B%22id%22%3A1%7D", settings.BOT_TOKEN) is None

class TestTokens:
    def test_token_contains_user_and_role(self):
        token = create_access_token({"sub": "7", "role": "teacher"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload["sub"] == "7"
        assert payload["role"] == "teacher"
        assert "exp" in payload

class TestSchemas:
    def test_lab_requires_math_model(self):
        with pytest.raises(ValidationError):
            LabCreate(title="Без модели")

    def test_lab_defaults(self):
        lab = LabCreate(title="Закон Ома", math_model={"blocks": [], "edges": []})

        assert lab.visibility == "private"
        assert lab.journal_columns == []
        assert lab.assigned_class_ids == []
        assert lab.is_published is False

    def test_attempt_grade_is_optional(self):

        request = AttemptFinishRequest()

        assert request.grade is None

    def test_classroom_grade_bounds(self):
        with pytest.raises(ValidationError):
            ClassroomCreate(grade="не число")
