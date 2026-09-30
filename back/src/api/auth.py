from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database.session import get_db_session
from src.models.models import Classroom, User
from src.schemas.schemas import AuthRequest, ProfileUpdate, TokenResponse, UserResponse
from src.core.config import settings
from src.core.security import validate_init_data, create_access_token
from src.api.deps import get_current_user

from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Аутентификация"])


async def get_or_create_classroom(session: AsyncSession, school: str, grade: int) -> Classroom:
    classroom = await session.scalar(
        select(Classroom).where(Classroom.school == school, Classroom.grade == grade)
    )
    if classroom:
        return classroom

    classroom = Classroom(school=school, grade=grade)
    session.add(classroom)
    await session.flush()
    return classroom

@router.post("/", response_model=TokenResponse)
async def authenticate_user(
    request: AuthRequest,
    session: AsyncSession = Depends(get_db_session)
):

    user_data = validate_init_data(request.initData, settings.BOT_TOKEN)
    if not user_data or "id" not in user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидная подпись initData",
        )

    max_user_id = user_data["id"]


    stmt = select(User).where(User.max_user_id == max_user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    is_new_user = False


    if not user:
        is_new_user = True


        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")
        full_name = f"{first_name} {last_name}".strip() or "Пользователь"

        user = User(
            max_user_id=max_user_id,
            username=user_data.get("username"),
            full_name=full_name,
            role=request.role
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)


    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})

    return TokenResponse(
        access_token=access_token,
        is_new_user=is_new_user,
        user=user
    )

class DevAuthRequest(BaseModel):
    max_user_id: int = 123456789
    role: str = "teacher"


@router.patch("/me", response_model=UserResponse, summary="Обновить профиль")
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)

    if current_user.role == "student" and current_user.school and current_user.class_number:
        classroom = await get_or_create_classroom(session, current_user.school, current_user.class_number)
        current_user.classroom_id = classroom.id

    await session.commit()
    await session.refresh(current_user)
    return current_user

@router.post("/dev-login", response_model=TokenResponse, summary="Логин для разработчика (Без проверки подписи)")
async def dev_authenticate(
    request: DevAuthRequest,
    session: AsyncSession = Depends(get_db_session)
):

    if not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev-логин отключен на проде"
        )


    stmt = select(User).where(User.max_user_id == request.max_user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    is_new_user = False


    if not user:
        is_new_user = True
        user = User(
            max_user_id=request.max_user_id,
            username=f"dev_{request.max_user_id}",
            full_name="Локальный Разработчик",
            role=request.role
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)


    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})

    return TokenResponse(
        access_token=access_token,
        is_new_user=is_new_user,
        user=user
    )