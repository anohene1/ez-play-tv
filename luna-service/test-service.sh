#!/bin/bash

# Test script for Luna Service
# Usage: ./test-service.sh YOUR_TV_NAME PORTAL_URL MAC_ADDRESS

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: ./test-service.sh YOUR_TV_NAME PORTAL_URL MAC_ADDRESS"
    echo "Example: ./test-service.sh webos-tv http://5tv.pro/c 00:1A:79:16:19:22"
    exit 1
fi

TV_NAME=$1
PORTAL_URL=$2
MAC_ADDRESS=$3
SERVICE_NAME="com.ezplaytv.stalker.service"

echo "🧪 Testing Luna Service on $TV_NAME"
echo ""

# Connect to TV via SSH
echo "📡 Connecting to TV..."
ares-shell -d $TV_NAME << EOF

echo ""
echo "1️⃣  Checking service status..."
luna-send -n 1 luna://${SERVICE_NAME}/getStatus '{}'

echo ""
echo "2️⃣  Initializing service..."
luna-send -n 1 luna://${SERVICE_NAME}/init '{
  "url": "${PORTAL_URL}",
  "mac": "${MAC_ADDRESS}"
}'

echo ""
echo "3️⃣  Getting genres..."
luna-send -n 1 luna://${SERVICE_NAME}/request '{
  "type": "itv",
  "action": "get_genres"
}'

echo ""
echo "4️⃣  Getting channels..."
luna-send -n 1 luna://${SERVICE_NAME}/request '{
  "type": "itv",
  "action": "get_ordered_list",
  "extraParams": {
    "genre": "*",
    "p": 1
  }
}'

echo ""
echo "5️⃣  Final status check..."
luna-send -n 1 luna://${SERVICE_NAME}/getStatus '{}'

echo ""
echo "✅ Tests completed!"
EOF
