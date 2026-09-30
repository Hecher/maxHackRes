from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from src.database.session import get_db_session
from src.models.models import Attempt, Lab, User
from src.schemas.schemas import (
    AttemptCreate,
    AttemptFinishRequest,
    AttemptListItem,
    AttemptResponse,
    AttemptReviewRequest,
)
from src.api.deps import get_current_user, get_current_teacher
from src.bot import notifications

router = APIRouter(prefix="/attempts", tags=["Попытки"])

@router.get("/", response_model=list[AttemptListItem], summary="Список попыток")
async def list_attempts(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    stmt = (
        select(Attempt, Lab.title, User.full_name, User.class_number)
        .join(Lab, Lab.id == Attempt.lab_id)
        .join(User, User.id == Attempt.student_id)
        .order_by(Attempt.started_at.desc())
    )

    if current_user.role == "teacher":
        stmt = stmt.where(Lab.author_id == current_user.id)
    else:
        stmt = stmt.where(Attempt.student_id == current_user.id)

    rows = (await session.execute(stmt)).all()

    return [
        AttemptListItem(
            id=attempt.id,
            student_id=attempt.student_id,
            lab_id=attempt.lab_id,
            mode=attempt.mode,
            status=attempt.status,
            result_data=attempt.result_data,
            grade=attempt.grade,
            comment=attempt.comment,
            started_at=attempt.started_at,
            finished_at=attempt.finished_at,
            lab_title=lab_title,
            student_name=student_name,
            class_number=class_number,
        )
        for attempt, lab_title, student_name, class_number in rows
    ]

@router.post("/", response_model=AttemptResponse, summary="Начать выполнение лабы")
async def create_attempt(
    request: AttemptCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    lab = await session.get(Lab, request.lab_id)
    if not lab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Лабораторная работа не найдена"
        )


    attempt = Attempt(
        student_id=current_user.id,
        lab_id=lab.id,
        mode=request.mode,
        status="in_progress"
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)

    return attempt

@router.post("/{attempt_id}/finish", response_model=AttemptResponse, summary="Завершить попытку")
async def finish_attempt(
    attempt_id: int,
    request: AttemptFinishRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    attempt = await session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    if attempt.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к чужой попытке")


    attempt.status = "finished"
    attempt.grade = request.grade
    attempt.comment = request.comment


    if request.result_data:

        attempt.result_data = request.result_data.model_dump(mode='json')
    else:
        attempt.result_data = None

    attempt.finished_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(attempt)


    lab = await session.get(Lab, attempt.lab_id)
    student = await session.get(User, attempt.student_id)
    if lab and student:
        teacher = await session.get(User, lab.author_id)
        if teacher:
            notifications.schedule(
                notifications.notify_submission(
                    teacher.max_user_id, student.full_name, lab.title, attempt.id
                )
            )

    return attempt


@router.post("/{attempt_id}/review", response_model=AttemptResponse, summary="Проверить работу (учитель)")
async def review_attempt(
    attempt_id: int,
    request: AttemptReviewRequest,
    current_user: User = Depends(get_current_teacher),
    session: AsyncSession = Depends(get_db_session)
):
    attempt = await session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    lab = await session.get(Lab, attempt.lab_id)
    if not lab or lab.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Это работа другого учителя"
        )

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(attempt, key, value)

    await session.commit()
    await session.refresh(attempt)

    return attempt


@router.delete("/{attempt_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить попытку")
async def delete_attempt(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    attempt = await session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    lab = await session.get(Lab, attempt.lab_id)
    is_author = bool(lab and lab.author_id == current_user.id)
    is_student = attempt.student_id == current_user.id

    if not (is_author or is_student):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эту попытку может удалить только её автор или ученик"
        )

    await session.delete(attempt)
    await session.commit()