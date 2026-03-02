# --- Stage 1: build the Worker with Wrangler -----------------------
FROM node:25-alpine AS builder

WORKDIR /app

# Install dependencies & wrangler
COPY package*.json wrangler.toml ./
RUN npm ci

# Copy source and build
COPY src ./src
RUN npx wrangler deploy --dry-run --outdir=dist

# --- Stage 2: minimal runtime with workerd -------------------------
FROM node:25-slim AS runtime

# Install ca-certificates for SSL, then install workerd via npm
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g @cloudflare/workerd-linux-arm64 && \
    ln -s /usr/local/lib/node_modules/@cloudflare/workerd-linux-arm64/bin/workerd /usr/local/bin/workerd && \
    workerd --version

WORKDIR /worker

# Bring in the compiled Worker bundle and config
COPY --from=builder /app/dist ./dist
COPY config.capnp ./config.capnp

# Expose the port workerd listens on
EXPOSE 8080

CMD ["workerd", "serve", "config.capnp"]
