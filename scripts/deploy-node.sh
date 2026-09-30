#!/bin/bash
set -euo pipefail

WORK_DIR="/opt/atlassian/pipelines/agent/build"
REMOTE_ROOT_DIR="/var/www/html/mes"
NODE_DIR="$WORK_DIR/node-server"
NODE_OUTPUT="$NODE_DIR/dist"
REMOTE_NODE_DEPLOY_DIR=${REMOTE_NODE_DEPLOY_DIR}

if [[ !  "${REMOTE_NODE_DEPLOY_DIR}"  ]]; then
  echo "❌ Missing required environment variables!"
  echo "Exiting safely..."
  exit 1
else
  echo "✅ Environment variables found:"
  echo "REMOTE_NODE_DEPLOY_DIR=${REMOTE_NODE_DEPLOY_DIR}"
fi


info() {
  echo "===> INFO:: $1"
}

run_build_tasks() {
  info "Entering Node-Server..."
  cd "$NODE_DIR" || { echo "Node folder not found"; exit 1; }

info "Installing Dependencies..."
npm install || { echo "npm install failed"; exit 1; }

info "Building Node..."
npm run build || { echo "Build failed"; exit 1; }

  info "Copying Prisma and package files..."
  cp -r prisma "$NODE_OUTPUT/" || { echo "Copying Prisma folder failed"; exit 1; }
  cp package.json "$NODE_OUTPUT/" || { echo "Copying package.json failed"; exit 1; }
  cp package-lock.json "$NODE_OUTPUT/" || { echo "Copying package-lock.json failed"; exit 1; }
}

deploy_to_remote() {
  if [[ ! -d "$NODE_OUTPUT" ]]; then
  echo "❌ Build failed — dist folder not found at $DIST_OUTPUT"
  exit 1
fi

LOCAL_BUILD_PATH="$NODE_OUTPUT"


if [[ ! "${REMOTE_NODE_DEPLOY_DIR}" ]]; then
  echo "❌ Missing Remote Deployment Directory!"
  echo "Exiting safely..."
  exit 1
else
echo "==> Uploading new build files to server..."
rsync -avz --delete \
  --exclude=node_modules \
  --exclude=.env \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$NODE_OUTPUT/" "$SERVER_USER@$SERVER_IP:$REMOTE_NODE_DEPLOY_DIR/"
fi
  info "Running remote commands..."
  ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" <<EOF
    set -euo pipefail
    cd "$REMOTE_NODE_DEPLOY_DIR" || { echo "Remote node-build folder not found"; exit 1; }

    echo "Installing remote dependencies..."
    npm install || { echo "Remote npm install failed"; exit 1; }

    echo "Generating remote Prisma client..."
    npx prisma generate || { echo "Remote Prisma generate failed"; exit 1; }

    echo "Restarting remote Node server..."
    pm2 reload all|| { echo "Remote Node server restart failed"; exit 1; }
   
    echo "Remote deployment tasks completed!"
EOF
}

info "Starting Node deployment process..."

run_build_tasks
deploy_to_remote

info "Node deployment completed successfully!"
exit 0
