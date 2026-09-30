from pydantic import PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


    PROJECT_NAME: str = "VLR Backend"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False


    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "vlr_db"

    @computed_field
    @property
    def async_database_url(self) -> str:
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_SERVER,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DB,
            )
        )


    JWT_SECRET_KEY: str = "snyusmumriki"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7


    BOT_TOKEN: str = "f9LHodD0cOJwh8dAFAd3j9g8mYGCwHOnxCntJ0zcpSlWaJB9WO5LBqTalEyaV7jxVfPlluu1gOovevBiHR1Z"


    MINIAPP_URL: str = "https://osleek.github.io/max-miniapp-react-test/"


    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()