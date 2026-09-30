import logging

from maxapi import Bot, Dispatcher
from maxapi.filters.command import Command, CommandStart
from maxapi.types import LinkButton, MessageCreated
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from sqlalchemy import select

from src.core.config import settings
from src.database.session import async_session_factory
from src.models.models import Classroom, Lab, User

logger = logging.getLogger(__name__)

REGISTRATION: dict[int, dict] = {}

REG_QUESTIONS = {
    "student": [
        ("full_name", "Введите ваше ФИО"),
        ("city", "Ваш город"),
        ("school", "Ваша школа"),
        ("class_number", "Укажите класс (цифрой)"),
    ],
    "teacher": [
        ("full_name", "Введите ваше ФИО"),
        ("city", "Ваш город"),
        ("school", "Ваша школа"),
        ("subject", "Какой предмет вы ведёте"),
    ],
}

def _miniapp_button(text: str = "Открыть лабораторию") -> list:
    keyboard = InlineKeyboardBuilder()
    keyboard.row(LinkButton(text=text, url=settings.MINIAPP_URL))
    return [keyboard.as_markup()]

def register_handlers(dp: Dispatcher, bot: Bot) -> None:
    @dp.message_created(CommandStart())
    async def start_command(event: MessageCreated) -> None:
        await event.message.answer(
            "Привет! Я бот виртуальных лабораторных работ.\n\n"
            "Что умею:\n"
            "/reg — регистрация (ученик или учитель)\n"
            "/learn — список доступных работ\n"
            "/buildlab — открыть конструктор (для учителя)\n\n"
            "Откройте мини-приложение, чтобы выполнить работу.",
            attachments=_miniapp_button(),
        )

    @dp.message_created(Command("reg"))
    async def reg_command(event: MessageCreated) -> None:
        user_id = event.from_user.user_id
        client = await _session_for(user_id)

        if client and client.city and client.school:
            await event.message.answer(
                f"{client.full_name}, вы уже зарегистрированы как "
                f"{'учитель' if client.role == 'teacher' else 'ученик'}.\n"
                "Чтобы изменить данные, напишите /reg заново."
            )
            return

        REGISTRATION[user_id] = {"step": "role", "data": {}}
        await event.message.answer("При регистрации укажите кто вы: Учитель или Ученик")

    @dp.message_created(Command("learn"))
    async def learn_command(event: MessageCreated) -> None:
        user_id = event.from_user.user_id

        async with async_session_factory() as session:
            user = await _user_by_max_id(session, user_id)
            if not user:
                await event.message.answer("Сначала зарегистрируйтесь: /reg")
                return

            conditions = [Lab.visibility == "public"]
            if user.role == "teacher":
                conditions.append(Lab.author_id == user.id)
            elif user.classroom_id:
                conditions.append(Lab.author_id == user.id)

            labs = (
                await session.execute(select(Lab).where(*conditions).order_by(Lab.created_at.desc()).limit(10))
            ).scalars().all()

        if not labs:
            await event.message.answer(
                "Пока доступных работ нет. Откройте мини-приложение — там каталог целиком.",
                attachments=_miniapp_button(),
            )
            return

        lines = ["Доступные работы:", ""]
        for lab in labs:
            lines.append(f"• {lab.title} ({lab.subject or 'без предмета'})")
        lines.append("")
        lines.append("Откройте мини-приложение, чтобы выполнить работу.")

        await event.message.answer("\n".join(lines), attachments=_miniapp_button())

    @dp.message_created(Command("buildlab"))
    async def buildlab_command(event: MessageCreated) -> None:
        user_id = event.from_user.user_id
        client = await _session_for(user_id)

        if client and client.role != "teacher":
            await event.message.answer("Конструктор доступен учителям. Регистрация: /reg")
            return

        await event.message.answer(
            "Откройте мини-приложение и нажмите «Создать» — конструктор работ там.\n"
            "Матмодель собирается из блоков, установка рисуется на шаге «Установка».",
            attachments=_miniapp_button("Открыть конструктор"),
        )

    @dp.message_created()
    async def registration_step(event: MessageCreated) -> None:
        user_id = event.from_user.user_id
        state = REGISTRATION.get(user_id)
        if not state:
            return

        text = (event.message.body.text or "").strip()
        if not text or text.startswith("/"):
            return

        if state["step"] == "role":
            lowered = text.lower()
            if lowered.startswith("уч"):
                role = "student" if "ученик" in lowered else "teacher"
                state["data"]["role"] = role
                state["step"] = "profile"
                state["index"] = 0
                await event.message.answer(REG_QUESTIONS[role][0][1])
                return
            await event.message.answer("Напишите «Учитель» или «Ученик»")
            return

        questions = REG_QUESTIONS[state["data"]["role"]]
        index = state.get("index", 0)
        field, _question = questions[index]
        state["data"][field] = text
        index += 1
        state["index"] = index

        if index < len(questions):
            await event.message.answer(questions[index][1])
            return

        await _save_profile(event, state["data"])
        REGISTRATION.pop(user_id, None)

    logger.info("Обработчики бота зарегистрированы")

async def _user_by_max_id(session, max_user_id: int) -> User | None:
    return await session.scalar(select(User).where(User.max_user_id == max_user_id))

async def _session_for(max_user_id: int) -> User | None:
    async with async_session_factory() as session:
        return await _user_by_max_id(session, max_user_id)

async def _save_profile(event: MessageCreated, data: dict) -> None:
    max_user_id = event.from_user.user_id

    async with async_session_factory() as session:
        user = await _user_by_max_id(session, max_user_id)

        if not user:
            user = User(
                max_user_id=max_user_id,
                username=event.from_user.username,
                full_name=data.get("full_name") or "Пользователь",
                role=data.get("role", "student"),
            )
            session.add(user)
            await session.flush()

        user.full_name = data.get("full_name") or user.full_name
        user.city = data.get("city") or user.city
        user.school = data.get("school") or user.school
        user.subject = data.get("subject") or user.subject

        if data.get("class_number"):
            try:
                grade = int(str(data["class_number"]).strip())
            except ValueError:
                grade = None

            if grade and user.school:
                user.class_number = grade
                classroom = await session.scalar(
                    select(Classroom).where(Classroom.school == user.school, Classroom.grade == grade)
                )
                if not classroom:
                    classroom = Classroom(school=user.school, grade=grade)
                    session.add(classroom)
                    await session.flush()
                user.classroom_id = classroom.id

        await session.commit()
        role = "учитель" if user.role == "teacher" else "ученик"

    await event.message.answer(
        f"Готово! {data.get('full_name', '')}, вы зарегистрированы как {role}.\n"
        "Откройте мини-приложение, чтобы посмотреть работы.",
        attachments=_miniapp_button(),
    )
