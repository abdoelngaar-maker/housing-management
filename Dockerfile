# ============================================
# Stage 1: Install dependencies and build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY patches ./patches/

# Install dependencies using npm (--legacy-peer-deps to resolve peer conflicts)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ============================================
# Stage 2: Production image
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json ./
COPY patches ./patches/

RUN npm install --omit=dev --legacy-peer-deps

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy drizzle migrations
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application using npm start to ensure migrations run
CMD ["npm", "start"]
