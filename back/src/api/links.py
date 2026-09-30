from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_teacher
from src.database.session import get_db_session
from src.models.models import TeacherStudentLink, User
from src.schemas.schemas import LinkCreate, LinkResponse

router = APIRouter(prefix="/links", tags=["Связи учитель — ученик"])

@router.get("/", response_model=list[LinkResponse], summary="Мои связанные ученики")
async def list_links(
    current_user: User = Depends(get_current_teacher),
    session: AsyncSession = Depends(get_db_session),
):
    stmt = (
        select(User, TeacherStudentLink)
        .join(TeacherStudentLink, TeacherStudentLink.student_id == User.id)
        .where(TeacherStudentLink.teacher_id == current_user.id)
        .order_by(User.full_name)
    )
    rows = (await session.execute(stmt)).all()

    return [
        LinkResponse(
            student_id=student.id,
            max_user_id=student.max_user_id,
            full_name=student.full_name,
            class_number=student.class_number,
            school=student.school,
        )
        for student, _link in rows
    ]

@router.post("/", response_model=LinkResponse, status_code=status.HTTP_201_CREATED,
             summary="Связать ученика с учителем")
async def create_link(
    payload: LinkCreate,
    current_user: User = Depends(get_current_teacher),
    session: AsyncSession = Depends(get_db_session),
):
    stmt = select(User).where(User.max_user_id == payload.student_max_user_id)
    student = (await session.execute(stmt)).scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ученик с таким MAX ID не найден: он должен сначала открыть мини-приложение",
        )
    if student.role != "student":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Это не ученик")

    exists = await session.execute(
        select(TeacherStudentLink).where(
            TeacherStudentLink.teacher_id == current_user.id,
            TeacherStudentLink.student_id == student.id,
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Связь уже существует")

    session.add(TeacherStudentLink(teacher_id=current_user.id, student_id=student.id))
    await session.commit()

    return LinkResponse(
        student_id=student.id,
        max_user_id=student.max_user_id,
        full_name=student.full_name,
        class_number=student.class_number,
        school=student.school,
    )
