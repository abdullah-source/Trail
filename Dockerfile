# Trail: one image serves the API and the built web app (DECISIONS §5).
# Stage 1: build the frontend. Stage 2: python runtime with the static bundle baked in.

FROM node:20-alpine AS web
WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile
COPY web/ ./
ARG VITE_EXTENSION_ID=
ARG VITE_CHROME_STORE_URL=
ENV VITE_MOCK=0 VITE_EXTENSION_ID=$VITE_EXTENSION_ID VITE_CHROME_STORE_URL=$VITE_CHROME_STORE_URL
RUN pnpm build

FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    TRAIL_DATA_DIR=/data STATIC_DIR=/app/trail/server/static PORT=8080
WORKDIR /app
RUN adduser --disabled-password --gecos "" trail && mkdir -p /data && chown trail /data
COPY pyproject.toml alembic.ini README.md ./
COPY trail/ ./trail/
COPY corpus/ ./corpus/
RUN pip install --upgrade pip && pip install ".[server]"
COPY --from=web /web/dist/ ./trail/server/static/
USER trail
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8080\")}/healthz').read()" || exit 1
# Railway overrides this with railway.json's startCommand (alembic upgrade head first); same command here.
CMD ["sh", "-c", "alembic upgrade head && uvicorn trail.server.app:create_app --factory --host 0.0.0.0 --port ${PORT:-8080} --no-access-log --proxy-headers --forwarded-allow-ips='*'"]
