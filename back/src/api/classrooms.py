from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_teacher, get_current_user
from src.database.session import get_db_session
from src.models.models import Classroom, TeacherStudentLink, User
from src.schemas.schemas import ClassroomCreate, ClassroomResponse

router = APIRouter(prefix="/classrooms", tags=["Классы"])

def to_response(classroom: Classroom, students_count: int) -> ClassroomResponse:
    return ClassroomResponse(
        id=classroom.id,
        school=classroom.school,
        grade=classroom.grade,
        label=f"{classroom.grade} класс",
        students_count=students_count,
    )

@router.get("/", response_model=list[ClassroomResponse], summary="Классы учителя")
async def list_classrooms(
    current_user: User = Depends(get_current_teacher),
    session: AsyncSession = Depends(get_db_session),
):

    linked_grades = (
        select(User.classroom_id)
        .join(TeacherStudentLink, TeacherStudentLink.student_id == User.id)
        .where(TeacherStudentLink.teacher_id == current_user.id, User.classroom_id.is_not(None))
        .scalar_subquery()
    )

    conditions = [Classroom.id.in_(linked_grades)]
    if current_user.school:
        conditions.append(Classroom.school == current_user.school)

    stmt = select(Classroom).where(or_(*conditions)).order_by(Classroom.grade)

    classrooms = (await session.execute(stmt)).scalars().all()

    result: list[ClassroomResponse] = []
    for classroom in classrooms:
        count = await session.scalar(
            select(func.count()).select_from(User).where(User.classroom_id == classroom.id)
        )
        result.append(to_response(classroom, int(count or 0)))

    return result

@router.post("/", response_model=ClassroomResponse, status_code=status.HTTP_201_CREATED,
             summary="Создать класс")
async def create_classroom(
    payload: ClassroomCreate,
    current_user: User = Depends(get_current_teacher),
    session: AsyncSession = Depends(get_db_session),
):
    school = payload.school or current_user.school
    if not school:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите школу: она не заполнена в профиле учителя",
        )
    if not 1 <= payload.grade <= 11:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Номер класса — от 1 до 11")

    existing = await session.scalar(
        select(Classroom).where(Classroom.school == school, Classroom.grade == payload.grade)
    )
    if existing:
        return to_response(existing, 0)

    classroom = Classroom(school=school, grade=payload.grade)
    session.add(classroom)
    await session.commit()
    await session.refresh(classroom)

    return to_response(classroom, 0)

@router.post("/advance-year", response_model=list[ClassroomResponse], summary="Перевести всех на следующий год")
async def advance_year(
    current_user: User = Depends(get_current_teacher),
    session: AsyncSession = Depends(get_db_session),
):
    school = current_user.school
    if not school:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="В профиле не указана школа")

    classrooms = (
        await session.execute(select(Classroom).where(Classroom.school == school).order_by(Classroom.grade.desc()))
    ).scalars().all()

    for classroom in classrooms:
        if classroom.grade >= 11:

            await session.execute(
                User.__table__.update().where(User.classroom_id == classroom.id).values(classroom_id=None)
            )
            await session.delete(classroom)
            continue

        classroom.grade += 1

    await session.commit()

    remaining = (
        await session.execute(select(Classroom).where(Classroom.school == school).order_by(Classroom.grade))
    ).scalars().all()

    return [to_response(classroom, 0) for classroom in remaining]
