FROM public.ecr.aws/docker/library/node:20-alpine3.22 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
RUN npm run build

FROM public.ecr.aws/docker/library/node:20-alpine3.22

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./

EXPOSE 3000

ENV PORT=3000
ENV BACKEND_URL=http://localhost:8080

CMD ["node", "server.js"]

