FROM node:22-bookworm-slim AS node
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN node --version
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY app.py /app/app.py
RUN groupadd -r raja && useradd -r -g raja -u 10001 raja
USER raja
EXPOSE 10000
CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers"]
