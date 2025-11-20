# syntax=docker/dockerfile:1.7-labs

ARG NODE_VERSION=22-bullseye

FROM node:${NODE_VERSION} AS builder
WORKDIR /app

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY examples ./examples
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm -r --filter @claude-agent-kit/* run build
RUN pnpm --filter claude-code-web build

# Create a production-ready copy of the claude-code-web package
RUN pnpm --filter claude-code-web deploy --prod --legacy /app/deploy
RUN rm -rf /app/deploy/dist && cp -R examples/claude-code-web/dist /app/deploy/dist

FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV WORKSPACE_DIR=/app/agent
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && npm install -g tsx@4.19.2

COPY --from=builder /app/deploy ./

RUN mkdir -p "${WORKSPACE_DIR}/.claude" && ln -sf "${WORKSPACE_DIR}/.claude" /root/.claude

EXPOSE 5173

CMD ["tsx", "src/server/index.ts"]
