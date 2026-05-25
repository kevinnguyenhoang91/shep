FROM node:22-alpine

RUN apk upgrade --no-cache && \
    apk add --no-cache bash curl git make g++ python3 wget

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /workspace
