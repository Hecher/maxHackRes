from base64 import b64decode
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_teacher, get_current_user, get_current_user_flexible
from src.bot import notifications
from src.database.session import get_db_session
from src.models.models import Classroom, Lab, LabAssignment, TeacherStudentLink, User
from src.schemas.schemas import AssignRequest, LabCreate, LabResponse, LabUpdate

router = APIRouter(prefix="/labs", tags=["Лабораторные работы"])


@router.get("/{lab_id}/guide", summary="Методичка файлом")
async def lab_guide(
    lab_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_flexible),
):
    """
    Отдаёт приложенный файл методички.

    Файл открывается обычной ссылкой, поэтому токен принимается и в
    заголовке, и в параметре — иначе в WebView MAX скачивание не работает.
    """
    lab = await session.get(Lab, lab_id)
    if not lab or not lab.guide_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Методичка не приложена")

    if current_user.role != "teacher" and not lab.is_published and lab.author_id not in (
        await session.scalars(
            select(TeacherStudentLink.teacher_id).where(TeacherStudentLink.student_id == current_user.id)
        )
    ).all() and lab.visibility != "public":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой работе")

    payload = lab.guide_file
    mime = "application/octet-stream"

    if payload.startswith("data:"):
        header, _, encoded = payload.partition(",")
        mime = header[5:].split(";")[0] or mime
        try:
            content = b64decode(encoded) if ";base64" in header else unquote(encoded).encode("utf-8")
        except Exception:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Файл повреждён")
    else:
        content = payload.encode("utf-8")

    filename = lab.guide_file_name or f"lab-{lab.id}-guide"

    return Response(
        content=content,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

async def assigned_class_ids(session: AsyncSession, lab_id: int) -> list[str]:
    rows = (
        await session.execute(
            select(LabAssignment.classroom_id).where(LabAssignment.lab_id == lab_id)
        )
    ).scalars().all()
    return [str(value) for value in rows]

def to_response(lab: Lab, author_name: str | None, class_ids: list[str]) -> LabResponse:
    return LabResponse(
        id=lab.id,
        author_id=lab.author_id,
        author_name=author_name,
        title=lab.title,
        subject=lab.subject,
        summary=lab.summary,
        goal=lab.goal,
        guide=lab.guide,
        guide_file=lab.guide_file,
        guide_file_name=lab.guide_file_name,
        visibility=lab.visibility,
        math_model=lab.math_model,
        scene=lab.scene,
        journal_columns=lab.journal_columns or [],
        assigned_class_ids=class_ids,
        noise_percent=float(lab.noise_percent) if lab.noise_percent is not None else None,
        max_rows=lab.max_rows,
        is_published=lab.is_published,
        created_at=lab.created_at,
    )

async def author_name_of(session: AsyncSession, author_id: int) -> str | None:
    author = await session.get(User, author_id)
    return author.full_name if author else None

async def sync_assignments(
    session: AsyncSession, lab_id: int, classroom_ids: list[str], teacher: User
) -> None:
    await session.execute(delete(LabAssignment).where(LabAssignment.lab_id == lab_id))

    for raw in classroom_ids:
        try:
            classroom_id = int(raw)
        except (TypeError, ValueError):
            continue

        classroom = await session.get(Classroom, classroom_id)
        if not classroom:
            continue
        if teacher.school and classroom.school != teacher.school:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Класс {classroom.grade} относится к другой школе",
            )

        session.add(LabAssignment(lab_id=lab_id, classroom_id=classroom_id))

@router.get("/", response_model=list[LabResponse])
async def get_labs(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(Lab, User.full_name)
        .join(User, User.id == Lab.author_id)
        .order_by(Lab.created_at.desc())
    )

    if current_user.role == "teacher":
        stmt = stmt.where(or_(Lab.author_id == current_user.id, Lab.visibility == "public"))
    else:
        teacher_ids = select(TeacherStudentLink.teacher_id).where(
            TeacherStudentLink.student_id == current_user.id
        )

        conditions = [Lab.visibility == "public", Lab.author_id.in_(teacher_ids)]

        if current_user.classroom_id:
            assigned_lab_ids = select(LabAssignment.lab_id).where(
                LabAssignment.classroom_id == current_user.classroom_id
            )
            conditions.append(Lab.id.in_(assigned_lab_ids))

        stmt = stmt.where(or_(*conditions))

    rows = (await session.execute(stmt)).all()

    result: list[LabResponse] = []
    for lab, name in rows:
        result.append(to_response(lab, name, await assigned_class_ids(session, lab.id)))

    return result

@router.get("/{lab_id}", response_model=LabResponse)
async def get_lab(
    lab_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    lab = await session.get(Lab, lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лабораторная работа не найдена")

    return to_response(lab, await author_name_of(session, lab.author_id), await assigned_class_ids(session, lab_id))

@router.post("/", response_model=LabResponse, status_code=status.HTTP_201_CREATED)
async def create_lab(
    lab_in: LabCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_teacher)
):

    data = lab_in.model_dump()

    class_ids = data.pop("assigned_class_ids", []) or []

    new_lab = Lab(**data, author_id=current_user.id)
    session.add(new_lab)
    await session.commit()
    await session.refresh(new_lab)

    await sync_assignments(session, new_lab.id, class_ids, current_user)
    await session.commit()

    return to_response(new_lab, current_user.full_name, await assigned_class_ids(session, new_lab.id))

@router.patch("/{lab_id}", response_model=LabResponse)
async def update_lab(
    lab_id: int,
    lab_update: LabUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_teacher)
):
    lab = await session.get(Lab, lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лабораторная работа не найдена")

    if lab.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Это работа другого учителя",
        )

    update_data = lab_update.model_dump(exclude_unset=True)
    class_ids = update_data.pop("assigned_class_ids", None)

    for key, value in update_data.items():
        setattr(lab, key, value)

    if class_ids is not None:
        await sync_assignments(session, lab_id, class_ids, current_user)

    await session.commit()
    await session.refresh(lab)

    return to_response(lab, current_user.full_name, await assigned_class_ids(session, lab_id))

@router.post("/{lab_id}/assign", response_model=LabResponse, summary="Выдать работу классам")
async def assign_lab(
    lab_id: int,
    payload: AssignRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_teacher),
):
    lab = await session.get(Lab, lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лабораторная работа не найдена")
    if lab.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Это работа другого учителя")

    await sync_assignments(session, lab_id, [str(value) for value in payload.classroom_ids], current_user)
    await session.commit()

    if payload.classroom_ids:
        student_ids = (
            await session.execute(
                select(User.max_user_id).where(User.classroom_id.in_(payload.classroom_ids))
            )
        ).scalars().all()
        first_classroom = await session.get(Classroom, payload.classroom_ids[0])
        grade = first_classroom.grade if first_classroom else 0
        notifications.schedule(
            notifications.notify_assignment(lab.title, grade, list(student_ids))
        )

    return to_response(lab, current_user.full_name, await assigned_class_ids(session, lab_id))
