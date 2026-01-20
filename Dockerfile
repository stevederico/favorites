# Multi-stage build for smaller production image
FROM denoland/deno:alpine-2.6.3 AS builder

WORKDIR /app

# Copy everything first (deno install scans source files)
COPY . .

# Install dependencies with deno
RUN deno install && cd backend && deno install

# Build frontend
RUN deno run build

# Production stage
FROM denoland/deno:alpine-2.6.3

# Runtime deps for native modules (bcrypt, onnxruntime)
RUN apk add --no-cache libstdc++ libgomp

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy backend
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/node_modules ./node_modules

# Copy package files
COPY package*.json ./

# Expose port
EXPOSE 8000

# Run server
WORKDIR /app/backend
CMD ["deno", "run", "-A", "server.js"]
