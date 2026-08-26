FROM oven/bun:1.4.0-slim

WORKDIR /app

COPY package.json yarn.lock ./

RUN bun install

COPY . .

CMD ["bun", "run", "dev:bun"]
