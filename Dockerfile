FROM node:20-slim

# Install Chrome shared library dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-freefont-ttf \
    fonts-liberation \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin the cache dir to /app so it's identical at build time and at runtime.
# Without this, npm ci writes Chrome to $HOME/.cache/puppeteer (/root),
# but Render overrides HOME=/opt/render at runtime, so puppeteer can't find it.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
