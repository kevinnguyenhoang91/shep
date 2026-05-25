FROM node:22-alpine

RUN apk upgrade --no-cache && \
    apk add --no-cache bash curl git make g++ python3 sudo wget

RUN npm install -g pnpm@10.33.0

RUN mkdir -p /pnpm/store /workspace && \
    chown -R node:node /pnpm /workspace

RUN echo "node ALL=(root) NOPASSWD: /bin/chown, /bin/mkdir" > /etc/sudoers.d/node-devcontainer && \
    chmod 0440 /etc/sudoers.d/node-devcontainer

WORKDIR /workspace
