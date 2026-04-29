FROM node:20-slim

# Install Chrome shared library dependencies (not chromium itself — puppeteer downloads its own Chrome)
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

COPY package*.json ./
# puppeteer downloads the correct Chrome version automatically during npm ci
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
