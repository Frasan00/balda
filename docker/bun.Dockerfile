FROM oven/bun:1.1.35-slim

WORKDIR /app

COPY package.json yarn.lock .

RUN bun install --frozen-lockfile

COPY . .

CMD ["bun", "run", "dev:bun"]
