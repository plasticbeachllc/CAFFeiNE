#!/bin/bash
set -e

# CAFFeiNE Build Script
# Piggybacks on existing AFFiNE build scripts

echo "☕️ Building CAFFeiNE Server..."

# In the open-source CAFFEiNE repo, the original
# @affine/server code is not included for licensing reasons.
# If a server package is not present, skip server build steps.
if [ ! -d "packages/backend/server" ]; then
  echo "⚠️  packages/backend/server is not present in this repository."
  echo "    Server build steps are skipped. Provide your own backend"
  echo "    image/binary when deploying CAFFEiNE."
  exit 0
fi

# 1. Build Server
echo "📦 Building @affine/server..."
yarn workspace @affine/server build

# 2. Generate Prisma Client
echo "🗄️ Generating Prisma Client..."
yarn workspace @affine/server prisma generate

# 3. Prepare Distribution Directory
DIST_DIR="./dist/caffeine"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 4. Copy Server Artifacts
echo "🚚 Copying server artifacts..."
cp -r packages/backend/server "$DIST_DIR/server"

# 5. Handle node_modules (Production only)
# In a real CI, we'd prune devDependencies. For local build, we copy or symlink.
# The Dockerfile expects node_modules inside /app (which is the server dir)
echo "🔗 Linking node_modules..."
# We need to ensure node_modules are available. 
# The GitHub action moves the root node_modules to packages/backend/server.
# We'll do a copy to be safe for the Docker build context.
cp -r node_modules "$DIST_DIR/server/node_modules"

# 6. Build Frontend (Optional - can skip if just testing server)
if [ "$1" == "--with-frontend" ]; then
  echo "🎨 Building Frontend..."
  yarn affine @affine/web build
  mkdir -p "$DIST_DIR/static"
  cp -r packages/frontend/apps/web/dist "$DIST_DIR/static/web"
fi

echo "✅ Build preparation complete in $DIST_DIR"
echo "🚀 To build Docker image: docker build -f Dockerfile.caffeine -t caffeine-server ."
