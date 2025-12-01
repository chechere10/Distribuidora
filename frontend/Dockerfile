# Frontend Dockerfile - Vite React build and Nginx serve
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG VITE_API_BASE=http://localhost:3001/api
ENV VITE_API_BASE=${VITE_API_BASE}
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./tsconfig.json
COPY vite.config.ts ./vite.config.ts
COPY index.html ./index.html
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]