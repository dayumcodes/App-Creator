# Multi-stage build for production optimization
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY vitest.config.ts ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S nginx
RUN adduser -S frontend -u 1001 -G nginx

# Set proper permissions
RUN chown -R frontend:nginx /usr/share/nginx/html
RUN chown -R frontend:nginx /var/cache/nginx
RUN chown -R frontend:nginx /var/log/nginx
RUN chown -R frontend:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown -R frontend:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Switch to non-root user
USER frontend

# Start nginx
CMD ["nginx", "-g", "daemon off;"]