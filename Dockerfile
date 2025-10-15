FROM node:18-alpine

WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# Copy source
COPY . ./

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
