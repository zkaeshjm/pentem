# Stage 1: Build
FROM cgr.dev/chainguard/wolfi-base:latest AS builder

RUN apk update && apk add --no-cache \
  nodejs-20 \
  npm \
  python3 \
  py3-pip \
  ruby \
  go \
  nmap \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  git \
  bash

# Install schemathesis
RUN pip3 install schemathesis==4.13.0

# Install subfinder
RUN go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Install whatweb
RUN git clone https://github.com/urbanadventurer/WhatWeb.git /opt/whatweb && \
  mkdir -p /usr/local/bin && \
  ln -s /opt/whatweb/whatweb /usr/local/bin/whatweb

WORKDIR /app

# Copy root workspace files
COPY pnpm-workspace.yaml .
COPY package.json .
COPY pnpm-lock.yaml .
COPY turbo.json .
COPY tsconfig.base.json .

# Create package directories
RUN mkdir -p packages/pentem-worker packages/pentem-shared

# Copy package configs (needed for dependency installation)
COPY packages/pentem-worker/package.json ./packages/pentem-worker/
COPY packages/pentem-worker/tsconfig.json ./packages/pentem-worker/
COPY packages/pentem-shared/package.json ./packages/pentem-shared/
COPY packages/pentem-shared/tsconfig.json ./packages/pentem-shared/

# Copy shared package source (workspace dependency of worker)
COPY packages/pentem-shared/src ./packages/pentem-shared/src

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy worker source
COPY packages/pentem-worker/src ./packages/pentem-worker/src

# Build
RUN pnpm build

# Stage 2: Runtime
FROM cgr.dev/chainguard/wolfi-base:latest

RUN apk update && apk add --no-cache \
  nodejs-20 \
  python3 \
  py3-pip \
  ruby \
  go \
  nmap \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  git \
  bash \
  su-exec \
  shadow

# Install schemathesis
RUN pip3 install schemathesis==4.13.0

# Copy built artifacts and dependencies from builder
COPY --from=builder /opt/whatweb /opt/whatweb
RUN mkdir -p /usr/local/bin && ln -s /opt/whatweb/whatweb /usr/local/bin/whatweb

COPY --from=builder /root/go/bin/subfinder /usr/local/bin/subfinder

COPY --from=builder /app /app

# Copy scripts
COPY scripts/save-deliverable /usr/local/bin/save-deliverable
COPY scripts/totp-generator /usr/local/bin/totp-generator
RUN chmod +x /usr/local/bin/save-deliverable /usr/local/bin/totp-generator

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
