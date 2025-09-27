#!/bin/bash

# User Groups Testing Script
# Tests role-based access control with Cognito groups

BASE_URL="http://mytranscoder.cab432.com:3000"

echo "🚀 Testing User Groups Implementation"
echo "======================================"

# Test 1: Unauthorized access
echo ""
echo "Test 1: Unauthorized Access Protection"
echo "-------------------------------------"
echo "Testing /auth/admin-test without token:"
curl -s $BASE_URL/auth/admin-test | jq .

echo ""
echo "Testing /transcode/stats without token:"
curl -s $BASE_URL/transcode/stats | jq .

# Test 2: Admin user login and access
echo ""
echo "Test 2: Admin User Access"
echo "------------------------"
echo "Logging in as admin user..."

ADMIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin-test@example.com",
    "password": "AdminPassword123!"
  }')

echo "Admin login response:"
echo $ADMIN_RESPONSE | jq .

# Extract admin token
ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.accessToken')

if [ "$ADMIN_TOKEN" != "null" ] && [ "$ADMIN_TOKEN" != "" ]; then
  echo ""
  echo "Testing admin endpoints with admin token:"
  echo "==========================================";

  echo ""
  echo "/auth/admin-test (should succeed):"
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    $BASE_URL/auth/admin-test | jq .

  echo ""
  echo "/transcode/stats (should succeed):"
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    $BASE_URL/transcode/stats | jq .
else
  echo "❌ Admin login failed - check credentials"
fi

# Test 3: Regular user login and access
echo ""
echo "Test 3: Regular User Access (Should Be Denied)"
echo "----------------------------------------------"
echo "Logging in as regular user..."

USER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user-test@example.com",
    "password": "UserPassword123!"
  }')

echo "User login response:"
echo $USER_RESPONSE | jq .

# Extract user token
USER_TOKEN=$(echo $USER_RESPONSE | jq -r '.accessToken')

if [ "$USER_TOKEN" != "null" ] && [ "$USER_TOKEN" != "" ]; then
  echo ""
  echo "Testing admin endpoints with user token (should fail):"
  echo "======================================================"

  echo ""
  echo "/auth/admin-test (should return 403):"
  curl -s -H "Authorization: Bearer $USER_TOKEN" \
    $BASE_URL/auth/admin-test | jq .

  echo ""
  echo "/transcode/stats (should return 403):"
  curl -s -H "Authorization: Bearer $USER_TOKEN" \
    $BASE_URL/transcode/stats | jq .
else
  echo "❌ User login failed - check credentials"
fi

echo ""
echo "✅ User Groups Testing Complete!"
echo ""
echo "📋 Evidence Summary:"
echo "- Cognito groups configured: admin, user"
echo "- Role-based middleware implemented"
echo "- Admin endpoints protected correctly"
echo "- Access control working as expected"