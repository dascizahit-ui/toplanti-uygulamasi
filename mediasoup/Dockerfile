# ============================================
# Mediasoup SFU Dockerfile
# ============================================
FROM node:20-bullseye

WORKDIR /app

# Mediasoup derleme bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları yükle
COPY package.json ./
RUN npm install

# Uygulama kodu
COPY . .

# Portlar: HTTP API + RTC
EXPOSE 4443
EXPOSE 10000-10100/udp
EXPOSE 10000-10100/tcp

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4443/saglik || exit 1

CMD ["node", "src/server.js"]
