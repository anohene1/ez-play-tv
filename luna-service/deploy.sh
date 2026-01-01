#!/bin/bash

# Quick deploy script for Luna Service
# Usage: ./deploy.sh YOUR_TV_NAME

if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh YOUR_TV_NAME"
    echo "Example: ./deploy.sh webos-tv"
    exit 1
fi

TV_NAME=$1
SERVICE_NAME="com.ezplaytv.stalker.service"

echo "🔨 Installing dependencies..."
npm install

echo "📦 Packaging service..."
ares-package .

echo "🗑️  Removing old version from TV..."
ares-install --device $TV_NAME --remove $SERVICE_NAME 2>/dev/null || true

echo "📲 Installing service on TV..."
ares-install --device $TV_NAME ${SERVICE_NAME}_1.0.0_all.ipk

echo "🚀 Launching service..."
ares-launch --device $TV_NAME $SERVICE_NAME

echo "✅ Service deployed successfully!"
echo ""
echo "📊 Check status with:"
echo "   luna-send -n 1 luna://${SERVICE_NAME}/getStatus '{}'"
echo ""
echo "📝 View logs with:"
echo "   ares-shell -d $TV_NAME"
echo "   journalctl -u ${SERVICE_NAME} -f"
