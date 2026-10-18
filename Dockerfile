FROM node:22.14.0-bookworm-slim AS build

WORKDIR /app

# Copy manifests first so dependency installation remains cacheable.
COPY music-player-ui/package.json music-player-ui/package-lock.json ./music-player-ui/
RUN npm ci --prefix music-player-ui

COPY music-player-ui ./music-player-ui
RUN npm run build --prefix music-player-ui

FROM node:22.14.0-bookworm-slim AS runtime

WORKDIR /app
COPY --from=build /app/music-player-ui ./music-player-ui

EXPOSE 4173
CMD ["npm", "run", "preview", "--prefix", "/app/music-player-ui", "--", "--host", "0.0.0.0"]
