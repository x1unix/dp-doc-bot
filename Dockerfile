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
ENV CHROME_PATH=/usr/bin/chromium

RUN apk add --no-cache  \
    tzdata \
    ca-certificates \
    curl \
    openssl \
    bash \
    xvfb \
    udev \
    ttf-freefont \
    chromium

RUN adduser -D -u 1000 bot && \
    mkdir /opt/bot && \
    chown bot:bot /opt/bot

USER bot

WORKDIR /opt/bot
COPY --from=builder --chown=bot:bot /tmp/work/dist /opt/bot/dist
COPY --from=builder --chown=bot:bot /tmp/work/node_modules /opt/bot/node_modules
COPY --from=builder --chown=bot:bot /tmp/work/package.json /tmp/work/package-lock.json /tmp/work/tsconfig.json /opt/bot/

# Doesn't work on Alpine containers
# RUN npx puppeteer browsers install chrome

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:8080/ping || exit 1

ENTRYPOINT npm run start
