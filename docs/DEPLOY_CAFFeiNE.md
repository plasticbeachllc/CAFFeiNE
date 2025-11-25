# Deploying CAFFeiNE to Ubuntu 24.04

This guide walks you through building the CAFFeiNE server locally and deploying it to your remote Ubuntu host as a drop-in replacement for AFFiNE.

## Standard Directory Structure

Based on the standard AFFiNE self-hosting configuration, your host likely uses the following structure (mapped via `.env` variables):

- **Config**: `~/.affine/self-host/config` (Mapped to `/root/.affine/config`)
- **Storage**: `~/.affine/self-host/storage` (Mapped to `/root/.affine/storage`)
- **Postgres Data**: `~/.affine/self-host/postgres` (Mapped to `/var/lib/postgresql/data`)

Ensure your `compose.yml` and `.env` files point to these locations.

## Prerequisites

- **Local Machine**: Source code, Docker, `yarn`.
- **Remote Host**: Ubuntu 24.04 with Docker and Docker Compose installed.
- **SSH Access**: You must be able to SSH into the remote host.

## Step 1: Build the Image Locally

First, we build the artifacts and the Docker image on your powerful local machine to avoid installing build dependencies on the production server.

```bash
# 1. Build the application artifacts
./scripts/caffeine-build.sh --with-frontend

# 2. Build the Docker image
# We tag it as 'caffeine-server:latest'
docker build -f Dockerfile.caffeine -t caffeine-server:latest .
```

## Step 2: Transfer Image to Host

Since we aren't using a registry (like Docker Hub or GHCR) yet, we'll save the image to a file and transfer it.

```bash
# 1. Save image to a tar file (compresses it)
echo "💾 Saving image..."
docker save caffeine-server:latest | gzip > caffeine-server.tar.gz

# 2. Upload to your remote host
# Replace 'user@your-host' with your actual SSH login
echo "Hz Uploading to host..."
scp caffeine-server.tar.gz user@your-host:~/caffeine-server.tar.gz
```

## Step 3: Deploy on Remote Host

Now, SSH into your server and apply the update.

```bash
# 1. SSH into the host
ssh user@your-host

# --- ON REMOTE HOST ---

# 2. Load the Docker image
docker load < caffeine-server.tar.gz

# 3. Navigate to your AFFiNE deployment directory
# (Assuming you have a standard self-hosted setup)
cd /path/to/affine/selfhost

# 4. Update docker-compose.yml
# You need to change the image for the 'backend' or 'affine' service.
# If you are using the standard compose file, it might look like this:
#
# services:
#   affine:
#     image: ghcr.io/toeverything/affine:stable
#
# CHANGE IT TO:
#
# services:
#   affine:
#     image: caffeine-server:latest
#     pull_policy: never  <-- IMPORTANT: tells Docker to use local image
#     environment:
#       - GITHUB_WEBHOOK_WORKSPACE_ID=your-workspace-id  <-- Add this!

# 5. Restart the service
docker compose up -d

# 6. Verify
docker compose logs -f affine
```

## Step 4: Configure Webhook (One-Time)

Ensure your server is accessible from the internet so GitHub can send webhooks.

1.  **Public URL**: Your server must have a domain (e.g., `https://affine.yourdomain.com`).
2.  **GitHub Setup**:
    - Go to your Repo -> Settings -> Webhooks.
    - Payload URL: `https://affine.yourdomain.com/api/webhook/github`
    - Content type: `application/json`
    - Events: `Push`

## Troubleshooting

- **"Image not found"**: Ensure you added `pull_policy: never` to your compose file so it doesn't try to pull `caffeine-server` from Docker Hub.
- **Database Errors**: Check logs. If you see migration errors (unlikely), you might need to run migrations, but CAFFeiNE is schema-compatible.
