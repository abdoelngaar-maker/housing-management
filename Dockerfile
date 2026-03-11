# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (better caching)
COPY package.json package-lock.json* ./
COPY patches ./patches/

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy rest of project
COPY . .

# Build project
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY patches ./patches/

# Install only production deps
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy build output
COPY --from=builder /app/dist ./dist

# Copy drizzle
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "start"]
