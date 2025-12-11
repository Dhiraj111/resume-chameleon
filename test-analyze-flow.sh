#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000/api"
USER_ID="test-user-123"
USER_EMAIL="test@example.com"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Resume Chameleon - E2E Flow Test${NC}"
echo -e "${BLUE}================================${NC}\n"

# Step 1: Upload Resume and Job Description
echo -e "${YELLOW}[Step 1]${NC} Uploading resume and job description..."

UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/analyze" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -H "x-user-email: $USER_EMAIL" \
  -d '{
    "jobDescription": "We are looking for a Senior React Engineer with 5+ years experience. Must be available for 24/7 on-call support. Competitive salary with heavy equity compensation.",
    "resumeText": "John Doe\nSoftware Engineer\n10 years experience building web applications with React, Node.js, and Python. Expert in full-stack development."
  }')

echo "Response: $UPLOAD_RESPONSE"

ANALYSIS_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"analysisId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ANALYSIS_ID" ]; then
  echo -e "${RED}❌ Failed to get analysis ID from upload response${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Analysis ID: $ANALYSIS_ID${NC}\n"

# Step 2: Wait for Kestra extraction (with polling)
echo -e "${YELLOW}[Step 2]${NC} Waiting for Kestra to extract text from resume..."
MAX_ATTEMPTS=120
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  
  POLL_RESPONSE=$(curl -s -X POST "$API_URL/analyze-poll" \
    -H "Content-Type: application/json" \
    -H "x-user-id: $USER_ID" \
    -d "{\"analysisId\": \"$ANALYSIS_ID\"}")
  
  echo "Poll attempt $ATTEMPT: $POLL_RESPONSE"
  
  STATUS=$(echo "$POLL_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$STATUS" = "completed" ]; then
    echo -e "${GREEN}✅ Analysis completed!${NC}\n"
    echo "Full response:"
    echo "$POLL_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POLL_RESPONSE"
    break
  elif [ "$STATUS" = "waiting" ]; then
    echo -e "${YELLOW}⏳ Still extracting... (attempt $ATTEMPT)${NC}"
    sleep 2
  else
    echo -e "${RED}❌ Error in poll response${NC}"
    echo "$POLL_RESPONSE"
    break
  fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo -e "${RED}❌ Polling timeout after $MAX_ATTEMPTS attempts${NC}"
  exit 1
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✅ E2E Flow Test Completed Successfully!${NC}"
echo -e "${GREEN}================================${NC}"
