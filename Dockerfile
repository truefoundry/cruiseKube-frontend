FROM public.ecr.aws/docker/library/node:20-alpine3.22 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time configuration. Vite inlines `VITE_*` vars at build time, so anything
# needed at runtime in the browser has to be set here.
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE

# PostHog (only used in demo builds; see src/posthog-config.ts).
ARG VITE_POSTHOG_ENABLED=false
ARG VITE_PUBLIC_POSTHOG_TOKEN=
ARG VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV VITE_POSTHOG_ENABLED=$VITE_POSTHOG_ENABLED
ENV VITE_PUBLIC_POSTHOG_TOKEN=$VITE_PUBLIC_POSTHOG_TOKEN
ENV VITE_PUBLIC_POSTHOG_HOST=$VITE_PUBLIC_POSTHOG_HOST

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

