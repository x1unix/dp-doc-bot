ARG APP_VERSION=1.0.0

FROM node:20-alpine3.19 as builder
ARG APP_VERSION
WORKDIR /tmp/work
COPY . ./
RUN npm install --include=dev && npm run build

FROM node:20-alpine3.19
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
ENV NODE_ENV=production
ENV HTTP_PORT=8080

RUN apk add --no-cache  \
    tzdata \
    ca-certificates \
    curl \
    openssl \
    bash

WORKDIR /opt/bot
COPY --from=builder /tmp/work/dist /opt/bot/dist
COPY --from=builder /tmp/work/node_modules /opt/bot/node_modules
COPY --from=builder /tmp/work/package.json /tmp/work/package-lock.json /tmp/work/tsconfig.json /opt/bot/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:8080/ping || exit 1

ENTRYPOINT npm run start
