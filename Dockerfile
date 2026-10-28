# The Golden Path: static site served by unprivileged nginx, ready for Google Cloud Run.
#
# Base images come from mirror.gcr.io, Google's pull-through mirror of Docker Hub. They are
# the same images, but Cloud Build pulls them without hitting Docker Hub's rate limits.

# ── Build: install, test, type-check and bundle ──────────────────────────────────────────────
FROM mirror.gcr.io/library/node:22.22.3-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# A failing data or scale test stops the deploy rather than shipping a wrong timeline.
RUN npm test && npm run build

# ── Serve: nginx as a non-root user on Cloud Run's $PORT ─────────────────────────────────────
FROM mirror.gcr.io/nginxinc/nginx-unprivileged:1.30.6-alpine
# Cloud Run injects PORT (8080 unless configured otherwise); the image's entrypoint renders
# /etc/nginx/templates/*.template with it at start-up.
ENV PORT=8080 \
    NGINX_ENTRYPOINT_WORKER_PROCESSES_AUTOTUNE=1
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
