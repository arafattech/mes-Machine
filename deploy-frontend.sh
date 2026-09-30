#!/bin/bash
set -euo pipefail

echo "==> Starting Frontend Build"

WORK_DIR="/opt/atlassian/pipelines/agent/build"
FRONTEND_DIR="$WORK_DIR/Frontend"
DIST_OUTPUT="$FRONTEND_DIR/dist/my-angular-csr"
ENV_FILE="$FRONTEND_DIR/src/environments/environment.ts"
API_URL=${API_URL}
REMOTE_DEPLOY_DIR=${REMOTE_DEPLOY_DIR}
REMOTE_VERSION_FILE=${REMOTE_VERSION_FILE}
v8Url=${v8Url}
BETA=${BETA}
APP_LOGO=${APP_LOGO}
SOCKET_SERVER_URL=${SOCKET_SERVER_URL}

if [[ !  "${API_URL}" || ! "${REMOTE_DEPLOY_DIR}" || ! "${REMOTE_VERSION_FILE}" || ! "${BETA}" || ! "${v8Url}" || ! "${SOCKET_SERVER_URL}" ]]; then
  echo "❌ Missing required environment variables!"
  echo "Exiting safely..."
  exit 1
else
  echo "✅ Environment variables found:"
  echo "API_URL=${API_URL}"
  echo "REMOTE_DEPLOY_DIR=${REMOTE_DEPLOY_DIR}"
  echo "REMOTE_VERSION_FILE=${REMOTE_VERSION_FILE}"
  echo "BETA=${BETA}"
  echo "v8Url=${v8Url}"
  echo "APP_LOGO=${APP_LOGO}"
  echo "SocketServer=${SOCKET_SERVER_URL}"
fi

echo "==> Fetching current build version from server..."
CURRENT_VERSION=$(ssh -o StrictHostKeyChecking=no  "$SERVER_USER@$SERVER_IP" "cat $REMOTE_VERSION_FILE 2>/dev/null || echo 1.0.0.0")

IFS='.' read -r MAJOR MINOR PATCH BUILD <<< "$CURRENT_VERSION"

if [[ "$BUILD" -lt 20 ]]; then
  BUILD=$((BUILD + 1))
else
  BUILD=0
  PATCH=$((PATCH + 1))
fi

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}.${BUILD}"

echo "==> Current build version updated to $NEW_VERSION"

echo "==> Creating environment.ts with API_URL: $API_URL"
cat > "$ENV_FILE" <<EOF
export const environment = {
  ServerApi: '${API_URL}',
  faceApiBaseUrl: 'https://dev.hybri.tech/face',
  SocketServer: '${SOCKET_SERVER_URL}',
  v8Url: '${v8Url}',
  appVersion: '${NEW_VERSION}${BETA}',
  appLogo: '${APP_LOGO}',
};
EOF

echo "Environment file created with version: ${NEW_VERSION}${BETA}"

echo "==> Angular Build Process Started..."
cd "$FRONTEND_DIR"
echo "==> Installing dependencies..."
npm install

echo "==> Building Angular project..."
npm run build

if [[ ! -d "$DIST_OUTPUT" ]]; then
  echo "❌ Build failed — dist folder not found at $DIST_OUTPUT"
  exit 1
fi

LOCAL_BUILD_PATH="$DIST_OUTPUT"



if [[ ! "${REMOTE_DEPLOY_DIR}" ]]; then
  echo "❌ Missing Remote Deployment Directory!"
  echo "Exiting safely..."
  exit 1
else
echo "==> Uploading new build files to server..."
rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no " \
  "$LOCAL_BUILD_PATH/" "$SERVER_USER@$SERVER_IP:$REMOTE_DEPLOY_DIR/"
fi

echo "==> Updating build version on server..."
ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "echo $NEW_VERSION > $REMOTE_VERSION_FILE"

echo "==> File Path: REMOTE_DEPLOY_DIR: ${REMOTE_DEPLOY_DIR}, REMOTE_VERSION_FILE: ${REMOTE_VERSION_FILE}"

echo "==> Deployment completed successfully on ${REMOTE_DEPLOY_DIR}! (Version: ${NEW_VERSION}${BETA}) ✅"
