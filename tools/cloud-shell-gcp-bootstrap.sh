#!/usr/bin/env bash
# Run in Google Cloud Shell for remote agents (Devin) when SA JSON keys are blocked.
set -euo pipefail

PROJECT_ID="hundesalon-nika-shell-2026"
REGION="europe-west3"
SERVICE_ACCOUNT="ai-agents-admin@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "${PROJECT_ID}"
gcloud config set run/region "${REGION}"
gcloud config set auth/impersonate_service_account "${SERVICE_ACCOUNT}"

echo "== HUNDESALON remote GCP bootstrap =="
echo "Project: ${PROJECT_ID}"
echo "Impersonation: ${SERVICE_ACCOUNT}"
echo ""
gcloud run services list --region="${REGION}" --format='table(name,status.url)'
echo ""
echo "Cloudflare DNS/deploy is separate — use CLOUDFLARE_API_TOKEN, not GCP."
