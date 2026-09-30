import asyncio
import logging

from maxapi import Bot

from src.core.config import settings

logger = logging.getLogger(__name__)

_bot: Bot | None = None

def set_bot(bot: Bot) -> None:
    global _bot
    _bot = bot

def get_bot() -> Bot | None:
    return _bot

async def notify_user(user_id: int, text: str, button_text: str | None = None, button_url: str | None = None) -> None:
    bot = _bot
    if bot is None:
        logger.info("Бот не инициализирован, уведомление пропущено: %s", text[:80])
        return

    from maxapi.types import LinkButton
    from maxapi.utils.inline_keyboard import InlineKeyboardBuilder

    attachments = None
    if button_text and button_url:
        keyboard = InlineKeyboardBuilder()
        keyboard.row(LinkButton(text=button_text, url=button_url))
        attachments = [keyboard.as_markup()]

    try:
        await bot.send_message(user_id=user_id, text=text, attachments=attachments)
    except Exception as error:
        logger.warning("Не удалось отправить уведомление %s: %s", user_id, error)

def schedule(coro) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(coro)

async def notify_assignment(lab_title: str, classroom_grade: int, student_ids: list[int]) -> None:
    text = (
        f"Учитель выдал новую лабораторную работу: «{lab_title}».\n"
        f"Класс: {classroom_grade}.\n"
        "Откройте мини-приложение, чтобы выполнить её."
    )
    for student_id in student_ids:
        await notify_user(student_id, text, "Открыть лабораторию", settings.MINIAPP_URL)

async def notify_submission(teacher_id: int, student_name: str, lab_title: str, attempt_id: int) -> None:
    text = (
        f"{student_name} сдал работу «{lab_title}».\n"
        f"Журнал замеров ждёт проверки — откройте раздел «Проверка»."
    )
    await notify_user(teacher_id, text, "Проверить работу", settings.MINIAPP_URL)
