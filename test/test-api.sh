#!/bin/bash

# Test Switchboard API
# Usage: ./test-api.sh [API_URL]

API_URL="${1:-http://localhost:3000/api/overlay}"

echo "🧪 Testing Switchboard API"
echo "API URL: $API_URL"
echo ""

# Test 1: Basic overlay
echo "Test 1: Basic product cover overlay..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "product-cover",
    "sizes": [{"width": 1080, "height": 1080}],
    "elements": {
      "product-image": {"url": "https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png"},
      "stt-cover": {"url": "https://i.postimg.cc/4dv39JsQ/cover.png"},
      "product-title": {"text": "Test Product"}
    }
  }' \
  --output test-result-1.png \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

if [ -f test-result-1.png ]; then
  SIZE=$(wc -c < test-result-1.png)
  echo "✅ Test 1 passed - Image size: $SIZE bytes"
else
  echo "❌ Test 1 failed - No image created"
fi

echo ""

# Test 2: Different size
echo "Test 2: Different dimensions (800x800)..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "product-cover",
    "sizes": [{"width": 800, "height": 800}],
    "elements": {
      "product-image": {"url": "https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png"},
      "stt-cover": {"url": "https://i.postimg.cc/4dv39JsQ/cover.png"}
    }
  }' \
  --output test-result-2.png \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

if [ -f test-result-2.png ]; then
  SIZE=$(wc -c < test-result-2.png)
  echo "✅ Test 2 passed - Image size: $SIZE bytes"
else
  echo "❌ Test 2 failed - No image created"
fi

echo ""

# Test 3: Error handling (missing required field)
echo "Test 3: Error handling (missing product-image)..."
RESPONSE=$(curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "product-cover",
    "sizes": [{"width": 1080, "height": 1080}],
    "elements": {
      "stt-cover": {"url": "https://i.postimg.cc/4dv39JsQ/cover.png"}
    }
  }' \
  -w "\nHTTP_STATUS:%{http_code}" \
  -s)

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$HTTP_STATUS" = "400" ]; then
  echo "✅ Test 3 passed - Correctly rejected invalid request"
else
  echo "❌ Test 3 failed - Expected HTTP 400, got $HTTP_STATUS"
fi

echo ""
echo "✅ Testing complete!"
echo ""
echo "View results:"
echo "  test-result-1.png - Basic overlay (1080x1080)"
echo "  test-result-2.png - Different size (800x800)"
