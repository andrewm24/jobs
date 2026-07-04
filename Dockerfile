# syntax=docker/dockerfile:1

# ---- Stage 1: install deps + build the client ----
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: runtime (Node 22 for node:sqlite + headed Chromium via noVNC) ----
FROM node:22-bookworm
WORKDIR /app
ENV NODE_ENV=production DISPLAY=:99

# noVNC stack so the headed apply-assist browser is viewable in a web browser.
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb x11vnc novnc websockify \
 && rm -rf /var/lib/apt/lists/*

# App (with node_modules + built client/dist) from the build stage.
COPY --from=build /app /app

# Chromium + its OS dependencies for Playwright apply-assist.
RUN npx playwright install --with-deps chromium

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001 6080
CMD ["/entrypoint.sh"]
