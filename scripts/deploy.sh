#!/bin/bash
# ============================================================================
# Deploy Azure Foundry Hybrid Pattern
# Bash deployment script for the centralized/federated landing zone
# ============================================================================

set -euo pipefail

LOCATION="${LOCATION:-eastus2}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
DEPLOYMENT_NAME="foundry-hybrid-$(date +%Y%m%d-%H%M%S)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_PATH="${SCRIPT_DIR}/../infra/main.bicep"
PARAMS_PATH="${SCRIPT_DIR}/../infra/main.bicepparam"

echo "============================================"
echo "  Azure Foundry - Hybrid Pattern Deployment"
echo "============================================"
echo ""

# ─── Prerequisites ─────────────────────────────────────────────────────────

echo "[1/5] Checking prerequisites..."

if ! command -v az &> /dev/null; then
    echo "ERROR: Azure CLI is not installed. Install from https://aka.ms/installazurecli"
    exit 1
fi

az bicep version &> /dev/null || az bicep install
echo "  ✓ Azure CLI and Bicep CLI available"

# ─── Authentication ─────────────────────────────────────────────────────────

echo "[2/5] Verifying authentication..."

if ! az account show &> /dev/null; then
    echo "  Logging in to Azure..."
    az login
fi

ACCOUNT_NAME=$(az account show --query name -o tsv)
ACCOUNT_ID=$(az account show --query id -o tsv)
echo "  ✓ Subscription: ${ACCOUNT_NAME} (${ACCOUNT_ID})"

# ─── Validate ──────────────────────────────────────────────────────────────

echo "[3/5] Validating Bicep template..."

az bicep build --file "${TEMPLATE_PATH}"
echo "  ✓ Template compiled successfully"

# ─── Deploy ────────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--what-if" ]]; then
    echo "[4/5] Running What-If analysis..."
    az deployment sub what-if \
        --location "${LOCATION}" \
        --template-file "${TEMPLATE_PATH}" \
        --parameters "${PARAMS_PATH}" \
        --name "${DEPLOYMENT_NAME}"
    echo ""
    echo "This was a preview. Run without --what-if to deploy."
    exit 0
fi

echo "[4/5] Deploying hybrid Foundry pattern..."
echo "  Deployment: ${DEPLOYMENT_NAME}"
echo "  Location: ${LOCATION}"
echo ""

az deployment sub create \
    --location "${LOCATION}" \
    --template-file "${TEMPLATE_PATH}" \
    --parameters "${PARAMS_PATH}" \
    --name "${DEPLOYMENT_NAME}" \
    --output json

# ─── Results ───────────────────────────────────────────────────────────────

echo ""
echo "[5/5] Deployment completed successfully!"
echo ""
echo "─── Next Steps ────────────────────────────────────"
echo "  1. Update Entra ID group IDs in main.bicepparam"
echo "  2. Configure private endpoints for production"
echo "  3. Set policyEnforcementMode to 'Default'"
echo "  4. Access the Foundry portal: https://ai.azure.com"
echo ""
