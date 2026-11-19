# Production multi-stage Dockerfile for BUILDsmore
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/src/db ./src/db

EXPOSE 3000

CMD ["npm", "run", "preview", "--", "--port=3000", "--host=0.0.0.0"]
