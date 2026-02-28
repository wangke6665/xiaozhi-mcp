#!/bin/bash
# QQ with NapCat Auto Start Script (Docker version)

echo "Starting QQ with NapCat Docker..."

# Stop and remove existing container
docker stop openclaw-qq 2>/dev/null || true
docker rm openclaw-qq 2>/dev/null || true
sleep 2

# Start new container with exposed ports
docker run -d --name openclaw-qq \
  -p 6099:6099 \
  -e NAPCAT_WEBUI_TOKEN=clawpanel-qq \
  --restart unless-stopped \
  mlikiowa/napcat-docker:latest

# Wait for NapCat to initialize
echo "Waiting for NapCat WebUI to start..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:6099/webui?token=clawpanel-qq > /dev/null 2>&1; then
        echo "✅ NapCat WebUI is ready at http://127.0.0.1:6099"
        echo "   Token: clawpanel-qq"
        exit 0
    fi
    sleep 2
done

echo "❌ Warning: NapCat WebUI may not be ready yet"
exit 1
