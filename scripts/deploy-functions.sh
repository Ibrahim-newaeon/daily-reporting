#!/bin/bash

# Deploy Cloud Functions for Marketing Dashboard SaaS
# Usage: ./deploy-functions.sh [environment]

set -e

ENVIRONMENT=${1:-production}
PROJECT_ID=${GCP_PROJECT:-"your-project-id"}
REGION=${GCP_REGION:-"us-central1"}
FUNCTIONS_DIR="./functions"

echo "=============================================="
echo "Deploying Cloud Functions to ${PROJECT_ID}"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "=============================================="

# Ensure we're authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null; then
  echo "Error: Not authenticated with gcloud. Run 'gcloud auth login' first."
  exit 1
fi

# Set project
gcloud config set project ${PROJECT_ID}

# Build TypeScript
echo "Building TypeScript..."
cd ${FUNCTIONS_DIR}
npm install
npm run build
cd ..

# Create Pub/Sub topic for scheduled reports (if not exists)
echo "Creating Pub/Sub topic..."
gcloud pubsub topics describe daily-reports 2>/dev/null || \
  gcloud pubsub topics create daily-reports

# Deploy generateDailyReports function
echo "Deploying generateDailyReports..."
gcloud functions deploy generateDailyReports \
  --gen2 \
  --runtime=nodejs20 \
  --region=${REGION} \
  --source=${FUNCTIONS_DIR}/dist \
  --entry-point=generateDailyReports \
  --trigger-topic=daily-reports \
  --memory=2048MB \
  --timeout=540s \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=${ENVIRONMENT}" \
  --set-secrets="FIREBASE_ADMIN_SDK_KEY=firebase-admin-key:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-token:latest,WHATSAPP_PHONE_ID=whatsapp-phone-id:latest,GCS_BUCKET=gcs-bucket:latest"

# Deploy HTTP trigger function for manual generation
# NOTE: --no-allow-unauthenticated requires IAM authentication
# Callers must have roles/cloudfunctions.invoker permission
echo "Deploying generateReportHttp..."
gcloud functions deploy generateReportHttp \
  --gen2 \
  --runtime=nodejs20 \
  --region=${REGION} \
  --source=${FUNCTIONS_DIR}/dist \
  --entry-point=generateReportHttp \
  --trigger-http \
  --memory=2048MB \
  --timeout=300s \
  --max-instances=20 \
  --no-allow-unauthenticated \
  --set-env-vars="NODE_ENV=${ENVIRONMENT}" \
  --set-secrets="FIREBASE_ADMIN_SDK_KEY=firebase-admin-key:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-token:latest,WHATSAPP_PHONE_ID=whatsapp-phone-id:latest,GCS_BUCKET=gcs-bucket:latest"

# Grant the web application's service account permission to invoke the function
echo "Setting up IAM for authenticated function invocation..."
gcloud functions add-iam-policy-binding generateReportHttp \
  --region=${REGION} \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker" \
  --gen2

# Create Cloud Scheduler job for daily reports
echo "Creating Cloud Scheduler job..."
gcloud scheduler jobs describe daily-reports-trigger 2>/dev/null && \
  gcloud scheduler jobs update pubsub daily-reports-trigger \
    --location=${REGION} \
    --schedule="0 8 * * *" \
    --time-zone="UTC" \
    --topic=daily-reports \
    --message-body='{"trigger": "scheduled"}' || \
  gcloud scheduler jobs create pubsub daily-reports-trigger \
    --location=${REGION} \
    --schedule="0 8 * * *" \
    --time-zone="UTC" \
    --topic=daily-reports \
    --message-body='{"trigger": "scheduled"}'

echo "=============================================="
echo "Deployment complete!"
echo ""
echo "Functions deployed:"
echo "  - generateDailyReports (Pub/Sub trigger)"
echo "  - generateReportHttp (HTTP trigger)"
echo ""
echo "Scheduler job: daily-reports-trigger"
echo "  Schedule: 0 8 * * * (8 AM UTC daily)"
echo "=============================================="
