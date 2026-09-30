FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1


COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/




COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt


COPY src/ ./src/

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]