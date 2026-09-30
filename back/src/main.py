import asyncio
import logging
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from maxapi import Bot, Dispatcher

from src.core.config import settings
from src.api.labs import router as labs_router
from src.api.auth import router as auth_router
from src.api.attempts import router as attempts_router
from src.api.links import router as links_router
from src.api.classrooms import router as classrooms_router
from src.api.components import router as components_router
from src.api.export import router as export_router
from src.bot import notifications
from src.bot.handlers import register_handlers

bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher()
register_handlers(dp, bot)
notifications.set_bot(bot)

async def start_bot():
    logging.info("Запуск поллинга бота MAX...")
    try:
        await dp.start_polling(bot)
    except Exception as error:
        logging.warning("Бот остановлен: %s", error)

@asynccontextmanager
async def lifespan(app: FastAPI):
    bot_task = asyncio.create_task(start_bot())
    yield
    bot_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(labs_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(attempts_router, prefix=settings.API_V1_STR)
app.include_router(links_router, prefix=settings.API_V1_STR)
app.include_router(classrooms_router, prefix=settings.API_V1_STR)
app.include_router(components_router, prefix=settings.API_V1_STR)
app.include_router(export_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
