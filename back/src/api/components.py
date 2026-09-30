from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.database.session import get_db_session
from src.models.models import Component, User
from src.schemas.schemas import ComponentCreate, ComponentResponse

router = APIRouter(prefix="/components", tags=["Компоненты"])

@router.get("/", response_model=list[ComponentResponse], summary="Мои составные компоненты")
async def list_components(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    components = (
        await session.execute(
            select(Component).where(Component.author_id == current_user.id).order_by(Component.created_at.desc())
        )
    ).scalars().all()

    return [
        ComponentResponse(
            id=item.id,
            name=item.name,
            graph=item.graph,
            created_at=item.created_at,
        )
        for item in components
    ]

@router.post("/", response_model=ComponentResponse, status_code=status.HTTP_201_CREATED,
             summary="Сохранить схему как компонент")
async def create_component(
    payload: ComponentCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    blocks = payload.graph.get("blocks", []) if isinstance(payload.graph, dict) else []
    kinds = {block.get("kind") for block in blocks if isinstance(block, dict)}

    if "input" not in kinds or "output" not in kinds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В компоненте нужен хотя бы один вход и один выход — иначе его некуда подключать",
        )

    component = Component(author_id=current_user.id, name=payload.name.strip() or "Компонент", graph=payload.graph)
    session.add(component)
    await session.commit()
    await session.refresh(component)

    return ComponentResponse(id=component.id, name=component.name, graph=component.graph, created_at=component.created_at)

@router.delete("/{component_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить компонент")
async def delete_component(
    component_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    component = await session.get(Component, component_id)
    if not component:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Компонент не найден")
    if component.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Это компонент другого учителя")

    await session.delete(component)
    await session.commit()
