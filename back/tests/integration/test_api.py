import os
import uuid

import httpx
import pytest

API = os.environ.get("VLR_API", "http://localhost:8000/api/v1")
SCHOOL = "Школа интеграционных тестов"

def api_available() -> bool:
    try:
        return httpx.get(f"{API}/openapi.json", timeout=2).status_code == 200
    except Exception:
        return False

pytestmark = pytest.mark.skipif(not api_available(), reason="API не запущен")

def login(max_user_id: int, role: str) -> dict:
    response = httpx.post(
        f"{API}/auth/dev-login", json={"max_user_id": max_user_id, "role": role}, timeout=10
    )
    response.raise_for_status()
    return response.json()

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def teacher() -> dict:
    return login(910001, "teacher")

@pytest.fixture(scope="module")
def student() -> dict:
    return login(910002, "student")

def test_catalog_requires_token():
    assert httpx.get(f"{API}/labs/", timeout=5).status_code in (401, 403)

def test_teacher_creates_lab_and_assigns(teacher, student):
    httpx.patch(
        f"{API}/auth/me",
        json={"school": SCHOOL, "city": "Город", "subject": "Физика"},
        headers=auth(teacher["access_token"]),
        timeout=10,
    )
    httpx.patch(
        f"{API}/auth/me",
        json={"school": SCHOOL, "city": "Город", "class_number": 8},
        headers=auth(student["access_token"]),
        timeout=10,
    )

    title = f"Тестовая работа {uuid.uuid4().hex[:8]}"
    created = httpx.post(
        f"{API}/labs/",
        json={
            "title": title,
            "subject": "Физика",
            "summary": "Проверка",
            "goal": "Проверка",
            "visibility": "private",
            "math_model": {"version": 1, "blocks": [], "edges": []},
            "journal_columns": [],
            "assigned_class_ids": [],
        },
        headers=auth(teacher["access_token"]),
        timeout=10,
    )
    assert created.status_code == 201
    lab = created.json()

    classrooms = httpx.get(f"{API}/classrooms/", headers=auth(teacher["access_token"]), timeout=10).json()
    classroom = next((room for room in classrooms if room["school"] == SCHOOL), None)
    if classroom is None:
        classroom = httpx.post(
            f"{API}/classrooms/", json={"grade": 8}, headers=auth(teacher["access_token"]), timeout=10
        ).json()

    assigned = httpx.post(
        f"{API}/labs/{lab['id']}/assign",
        json={"classroom_ids": [classroom["id"]]},
        headers=auth(teacher["access_token"]),
        timeout=10,
    )
    assert assigned.status_code == 200
    assert str(classroom["id"]) in assigned.json()["assigned_class_ids"]

    student_labs = httpx.get(f"{API}/labs/", headers=auth(student["access_token"]), timeout=10).json()
    assert any(item["id"] == lab["id"] for item in student_labs)

def test_attempt_lifecycle_and_review(teacher, student):
    labs = httpx.get(f"{API}/labs/", headers=auth(teacher["access_token"]), timeout=10).json()
    lab = next(item for item in labs if item["title"].startswith("Тестовая работа"))

    attempt = httpx.post(
        f"{API}/attempts/",
        json={"lab_id": lab["id"], "mode": "work"},
        headers=auth(student["access_token"]),
        timeout=10,
    )
    assert attempt.status_code == 200
    attempt_id = attempt.json()["id"]

    finished = httpx.post(
        f"{API}/attempts/{attempt_id}/finish",
        json={
            "result_data": {
                "measurements": [{"step": 1, "inputs": {}, "outputs": {"I": 2.3}}],
                "answers": {
                    "rows": [{"id": "r1", "number": 1, "values": {"u": 2.3, "i": 2.3, "r": 1.0}}],
                    "columns": [
                        {"key": "u", "label": "U", "unit": "В", "source": "auto"},
                        {"key": "i", "label": "I", "unit": "А", "source": "auto"},
                        {"key": "r", "label": "R", "unit": "Ом", "source": "manual"},
                    ],
                    "conclusion": "Сила тока растёт с напряжением",
                },
            }
        },
        headers=auth(student["access_token"]),
        timeout=10,
    )
    assert finished.status_code == 200
    assert finished.json()["status"] == "finished"

    listed = httpx.get(f"{API}/attempts/", headers=auth(teacher["access_token"]), timeout=10).json()
    assert any(item["id"] == attempt_id for item in listed)

    reviewed = httpx.post(
        f"{API}/attempts/{attempt_id}/review",
        json={"grade": 5, "comment": "Верно"},
        headers=auth(teacher["access_token"]),
        timeout=10,
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["grade"] == 5

    export = httpx.get(f"{API}/attempts/{attempt_id}/export.xls", headers=auth(teacher["access_token"]), timeout=10)
    assert export.status_code == 200
    assert "Журнал замеров" in export.text
    assert "Сила тока растёт с напряжением" in export.text


def test_guide_file_round_trip(teacher):
    title = f"Работа с методичкой {uuid.uuid4().hex[:8]}"

    created = httpx.post(
        f"{API}/labs/",
        json={
            "title": title,
            "subject": "Физика",
            "visibility": "private",
            "math_model": {"version": 1, "blocks": [], "edges": []},
            "guide_file": "data:text/plain;base64,0JzQtdGC0L7QtNC40YfQutCw",
            "guide_file_name": "metodichka.txt",
        },
        headers=auth(teacher["access_token"]),
        timeout=10,
    )
    assert created.status_code == 201

    lab = created.json()
    assert lab["guide_file_name"] == "metodichka.txt"
    assert lab["guide_file"].startswith("data:text/plain")

    fetched = httpx.get(f"{API}/labs/{lab['id']}", headers=auth(teacher["access_token"]), timeout=10)
    assert fetched.json()["guide_file"] == lab["guide_file"]

def test_foreign_lab_cannot_be_edited(teacher, student):
    labs = httpx.get(f"{API}/labs/", headers=auth(teacher["access_token"]), timeout=10).json()
    lab = labs[0]

    response = httpx.patch(
        f"{API}/labs/{lab['id']}",
        json={"title": "Подмена"},
        headers=auth(student["access_token"]),
        timeout=10,
    )
    assert response.status_code == 403
