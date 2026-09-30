FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ARG VITE_MAX_BOT_NAME=vlr_bot
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAX_BOT_NAME=$VITE_MAX_BOT_NAME

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
