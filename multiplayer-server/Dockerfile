# Servidor de salas de Ars Anima. Construir desde la raíz del repositorio:
#   docker build -f multiplayer-server/Dockerfile -t ars-anima-rooms .
FROM oven/bun:1.2 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml tsconfig.json ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY multiplayer-server/package.json multiplayer-server/bun.lock ./multiplayer-server/
RUN cd multiplayer-server && bun install --frozen-lockfile
COPY src ./src
COPY multiplayer-server/src ./multiplayer-server/src
RUN cd multiplayer-server && bun build src/index.ts --target=bun --outdir /out

FROM oven/bun:1.2-slim
WORKDIR /srv
COPY --from=build /out ./
ENV PORT=2567
EXPOSE 2567
CMD ["bun", "index.js"]
