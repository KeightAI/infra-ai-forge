FROM node:20-alpine

# Install git (required for cloning repos)
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY dist ./dist

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "dist/index.js"]