FROM denoland/deno:2.6.2

WORKDIR /app

COPY . .

RUN deno cache --unstable-sloppy-imports --import-map import_map.json test/server/index.ts

CMD ["deno", "task", "dev"]
