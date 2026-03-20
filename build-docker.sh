#!/bin/bash
# ============================================
# 資產管理 - Docker Image 建置腳本
# ============================================
# 使用方式：
#   chmod +x build-docker.sh
#   ./build-docker.sh
#
# 建置完成後會產生 asset-manager.tar 檔案
# 可複製到其他電腦執行：
#   docker load -i asset-manager.tar
#   docker run -d -p 3000:3000 -v ./data:/app/data -e JWT_SECRET=你的密鑰 asset-manager:latest
# ============================================

set -e

IMAGE_NAME="asset-manager"
IMAGE_TAG="latest"
OUTPUT_FILE="asset-manager.tar"

echo "===== 開始建置 Docker Image ====="
echo ""

# 建置 Image
echo "[1/2] 建置 ${IMAGE_NAME}:${IMAGE_TAG} ..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo ""
echo "[2/2] 匯出為 ${OUTPUT_FILE} ..."
docker save ${IMAGE_NAME}:${IMAGE_TAG} -o ${OUTPUT_FILE}

FILE_SIZE=$(du -h ${OUTPUT_FILE} | cut -f1)
echo ""
echo "===== 建置完成 ====="
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "檔案:  ${OUTPUT_FILE} (${FILE_SIZE})"
echo ""
echo "在其他電腦上使用："
echo "  1. docker load -i ${OUTPUT_FILE}"
echo "  2. docker run -d \\"
echo "       --name asset-manager \\"
echo "       --restart unless-stopped \\"
echo "       -p 3000:3000 \\"
echo "       -v \$(pwd)/data:/app/data \\"
echo "       -e JWT_SECRET=你的密鑰 \\"
echo "       -e GOOGLE_CLIENT_ID=選填 \\"
echo "       ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "  3. 開啟瀏覽器 http://localhost:3000"
