# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY contracts/package*.json ./contracts/

# Install all dependencies
RUN npm install && \
    cd backend && npm install && \
    cd ../frontend && npm install && \
    cd ../contracts && npm install

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy installed modules and code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
