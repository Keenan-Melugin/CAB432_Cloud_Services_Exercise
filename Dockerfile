# Video Transcoding Service Dockerfile
# CAB432 Assignment 1

FROM node:18-bullseye

# Install FFmpeg and Python for video processing and YouTube downloading
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install youtube-dl and yt-dlp for YouTube video downloading
RUN pip3 install --upgrade youtube-dl yt-dlp

# Verify FFmpeg installation
RUN ffmpeg -version

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads/original uploads/processed data

# Set permissions
RUN chmod -R 755 uploads data

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "index.js"]