FROM alpine:3.19

# Install essential dependencies for Bun, Chrome/Chromium, and Puppeteer
RUN apk add --no-cache \
    curl \
    unzip \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    npm \
    bash \
    font-noto \
    font-noto-cjk \
    font-noto-emoji \
    # Additional dependencies for Puppeteer on Alpine
    udev \
    ttf-opensans \
    ttf-dejavu \
    fontconfig \
    dbus \
    # Build tools that might be needed
    python3 \
    make \
    g++

# Create user specifically for running Puppeteer (non-root for security)
RUN addgroup -S pptruser && \
    adduser -S -G pptruser -h /home/pptruser pptruser && \
    adduser pptruser audio && \
    adduser pptruser video && \
    mkdir -p /home/pptruser/.config/puppeteer && \
    chown -R pptruser:pptruser /home/pptruser

# Set Puppeteer environment variables for Alpine/Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# CRITICAL FIX: Explicitly set the data directory to the non-root user's home
ENV PUPPETEER_USER_DATA_DIR=/home/pptruser/.config/puppeteer
# Additional configuration to ensure Puppeteer uses the correct directory
ENV HOME=/home/pptruser
ENV CHROME_USER_DATA_DIR=/home/pptruser/.config/puppeteer

# Install the latest version of Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /home/pptruser/.bun/bin/bun /usr/local/bin/bun

ENV PATH="/usr/local/bin:${PATH}"

# Set working directory for the application
WORKDIR /app

# Create app directory and set ownership
RUN mkdir -p /app && chown -R pptruser:pptruser /app

# Copy package.json and bun.lockb (if you have one) first for dependency installation
# Keep as root user for installation
COPY package.json bun.lockb* ./

# Install Bun dependencies including puppeteer
RUN bun install && \
    # Ensure permissions are set correctly for puppeteer
    chown -R pptruser:pptruser /app

# Install SST globally
RUN npm install -g aws-cdk aws-cdk-lib @serverless-stack/cli

# Copy the rest of your application code
COPY --chown=pptruser:pptruser . .

# Switch to the non-privileged user for running the application
USER pptruser

# Verify configuration directories exist and have correct permissions
RUN mkdir -p /home/pptruser/.config/puppeteer && \
    echo "Testing permissions for $HOME/.config/puppeteer" && \
    ls -la $HOME/.config

# Command to run your application (uncomment and adjust as needed)
# CMD ["bun", "run", "start"]