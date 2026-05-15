# Stage 1: Build
FROM cgr.dev/chainguard/wolfi-base:latest AS builder

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
  bash

# Install schemathesis
RUN pip3 install schemathesis==4.13.0

# Install subfinder
RUN go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Install whatweb
RUN git clone https://github.com/urbanadventurer/WhatWeb.git /opt/whatweb && \
  ln -s /opt/whatweb/whatweb /usr/local/bin/whatweb

WORKDIR /app

# Copy package files
COPY packages/pentem-worker/package.json .
COPY pnpm-workspace.yaml .
COPY package.json .
COPY pnpm-lock.yaml .

# Copy shared package
COPY packages/pentem-shared ./packages/pentem-shared

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy worker source
COPY packages/pentem-worker/src ./src

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
RUN ln -s /opt/whatweb/whatweb /usr/local/bin/whatweb

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
