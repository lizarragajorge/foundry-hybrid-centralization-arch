# ============================================================================
# Script #4: Aggregate RAI Compliance State Across Subscriptions
#
# Purpose: Queries Azure Policy compliance state for all Foundry-related
# policies across subscriptions, aggregates the RAI (Responsible AI)
# posture, and publishes to a Log Analytics custom table for dashboarding.
#
# Data published:
#   - Per-subscription RAI compliance summary
#   - Per-Foundry-resource guardrail status (raiPolicy presence/config)
#   - Content filter compliance details
#   - Non-compliant resource inventory
#
# Target: Log Analytics custom table (FoundryRAICompliance_CL)
#
# Usage:
#   .\aggregate-rai-state.ps1 -WorkspaceId <LAW-id> -WorkspaceKey <key>
#   .\aggregate-rai-state.ps1 -WorkspaceId <LAW-id> -WorkspaceKey <key> -MgName "contoso-ai"
#
# Schedule: Run via Azure Automation / Logic App / cron — recommended every 6h
# ============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$WorkspaceId,

    [Parameter(Mandatory)]
    [string]$WorkspaceKey,

    [string]$MgName = "",

    [string[]]$SubscriptionIds = @(),

    [string]$CustomTableName = "FoundryRAICompliance",

    [switch]$IncludeResourceDetails
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ─── Constants ───────────────────────────────────────────────────────────────

$FOUNDRY_POLICY_PREFIX = "foundry-"
$RAI_POLICY_IDS = @(
    "af253d37-136a-42f8-a1fc-30010c083d41"  # Data plane content filter
    "foundry-dine-standard-guardrails"        # Custom DINE guardrails
    "foundry-modify-enforce-guardrail"        # Custom Modify raiPolicyName
    "foundry-audit-missing-guardrail"         # Custom Audit missing guardrail
)

# ─── Functions ───────────────────────────────────────────────────────────────

function Send-LogAnalyticsData {
    <#
    .SYNOPSIS
        Posts JSON data to a Log Analytics custom table via the Data Collector API.
    #>
    param(
        [Parameter(Mandatory)][string]$WorkspaceId,
        [Parameter(Mandatory)][string]$WorkspaceKey,
        [Parameter(Mandatory)][string]$Body,
        [Parameter(Mandatory)][string]$LogType
    )

    $method = "POST"
    $contentType = "application/json"
    $resource = "/api/logs"
    $rfc1123date = [DateTime]::UtcNow.ToString("r")
    $contentLength = [System.Text.Encoding]::UTF8.GetByteCount($Body)

    $xHeaders = "x-ms-date:$rfc1123date"
    $stringToHash = "$method`n$contentLength`n$contentType`n$xHeaders`n$resource"
    $bytesToHash = [System.Text.Encoding]::UTF8.GetBytes($stringToHash)
    $keyBytes = [Convert]::FromBase64String($WorkspaceKey)
    $sha256 = New-Object System.Security.Cryptography.HMACSHA256
    $sha256.Key = $keyBytes
    $calculatedHash = $sha256.ComputeHash($bytesToHash)
    $encodedHash = [Convert]::ToBase64String($calculatedHash)
    $authorization = "SharedKey ${WorkspaceId}:${encodedHash}"

    $uri = "https://$WorkspaceId.ods.opinsights.azure.com$resource`?api-version=2016-04-01"

    $headers = @{
        "Authorization"        = $authorization
        "Log-Type"             = $LogType
        "x-ms-date"            = $rfc1123date
        "time-generated-field" = "TimeGenerated"
    }

    Invoke-RestMethod -Uri $uri -Method $method -ContentType $contentType -Headers $headers -Body $Body
}

function Get-FoundryResources {
    <#
    .SYNOPSIS
        Discovers all Foundry resources (AIServices) in a subscription.
    #>
    param([string]$SubscriptionId)

    $resources = az resource list `
        --subscription $SubscriptionId `
        --resource-type "Microsoft.CognitiveServices/accounts" `
        --query "[?kind=='AIServices'].{id:id, name:name, resourceGroup:resourceGroup, location:location, tags:tags}" `
        -o json 2>$null | ConvertFrom-Json

    return $resources
}

function Get-RaiPolicies {
    <#
    .SYNOPSIS
        Lists raiPolicies on a Foundry resource via REST API.
    #>
    param(
        [string]$FoundryName,
        [string]$ResourceGroup,
        [string]$SubscriptionId
    )

    $token = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv
    $uri = "https://management.azure.com/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.CognitiveServices/accounts/$FoundryName/raiPolicies?api-version=2025-06-01"

    try {
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers @{ Authorization = "Bearer $token" }
        return $response.value
    }
    catch {
        Write-Warning "  Failed to query raiPolicies for $FoundryName : $_"
        return @()
    }
}

function Get-ModelDeployments {
    <#
    .SYNOPSIS
        Lists model deployments on a Foundry resource.
    #>
    param(
        [string]$FoundryName,
        [string]$ResourceGroup,
        [string]$SubscriptionId
    )

    $deployments = az cognitiveservices account deployment list `
        --name $FoundryName `
        -g $ResourceGroup `
        --subscription $SubscriptionId `
        --query "[].{name:name, model:properties.model.name, version:properties.model.version, raiPolicy:properties.raiPolicyName, sku:sku.name, tpm:sku.capacity}" `
        -o json 2>$null | ConvertFrom-Json

    return $deployments
}

function Get-PolicyComplianceForSubscription {
    <#
    .SYNOPSIS
        Gets policy compliance state for Foundry-related policies in a subscription.
    #>
    param([string]$SubscriptionId)

    $summary = az policy state summarize `
        --subscription $SubscriptionId `
        --filter "policyDefinitionName eq 'foundry-dine-standard-guardrails' or policyDefinitionName eq 'foundry-modify-enforce-guardrail' or policyDefinitionName eq 'foundry-audit-missing-guardrail' or contains(policyDefinitionId, 'af253d37-136a-42f8-a1fc-30010c083d41')" `
        -o json 2>$null | ConvertFrom-Json

    return $summary
}

# ─── Main Execution ──────────────────────────────────────────────────────────

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Foundry RAI State Aggregation" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC' -AsUTC)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Determine subscriptions to scan
if ($SubscriptionIds.Count -gt 0) {
    $subscriptions = $SubscriptionIds | ForEach-Object {
        @{ id = $_; displayName = (az account show --subscription $_ --query name -o tsv) }
    }
}
elseif ($MgName) {
    Write-Host "`n  Discovering subscriptions under MG: $MgName..." -ForegroundColor Yellow
    $subscriptions = az account management-group entities list `
        --query "[?contains(parent.id, '$MgName') && type=='Microsoft.Management/managementGroups/subscriptions'].{id:name, displayName:displayName}" `
        -o json 2>$null | ConvertFrom-Json
    if (-not $subscriptions) {
        $subscriptions = az account list --query "[?state=='Enabled'].{id:id, displayName:name}" -o json | ConvertFrom-Json
    }
}
else {
    Write-Host "`n  Scanning all accessible subscriptions..." -ForegroundColor Yellow
    $subscriptions = az account list --query "[?state=='Enabled'].{id:id, displayName:name}" -o json | ConvertFrom-Json
}

Write-Host "  Found $($subscriptions.Count) subscription(s)" -ForegroundColor Green

$allRecords = [System.Collections.ArrayList]::new()
$timestamp = (Get-Date).ToUniversalTime().ToString("o")

foreach ($sub in $subscriptions) {
    $subId = $sub.id
    $subName = $sub.displayName
    Write-Host "`n── Subscription: $subName ($subId) ──" -ForegroundColor Yellow

    # Set subscription context
    az account set --subscription $subId 2>$null

    # 1. Discover Foundry resources
    $foundryResources = Get-FoundryResources -SubscriptionId $subId
    Write-Host "  Foundry resources: $($foundryResources.Count)"

    if ($foundryResources.Count -eq 0) {
        $record = [ordered]@{
            TimeGenerated         = $timestamp
            SubscriptionId        = $subId
            SubscriptionName      = $subName
            FoundryResourceCount  = 0
            TotalDeployments      = 0
            DeploymentsWithGuardrail = 0
            DeploymentsMissingGuardrail = 0
            RaiPoliciesCount      = 0
            HasEnterpriseStandard = $false
            ComplianceState       = "NoResources"
            CompliancePercentage  = 100
            NonCompliantPolicies  = @()
        }
        $null = $allRecords.Add($record)
        continue
    }

    $subTotalDeployments = 0
    $subWithGuardrail = 0
    $subMissingGuardrail = 0
    $subRaiPolicies = 0
    $subHasEnterprise = $false

    foreach ($fr in $foundryResources) {
        Write-Host "  ├─ $($fr.name) ($($fr.location))" -ForegroundColor White

        # 2. Check raiPolicies
        $raiPolicies = Get-RaiPolicies -FoundryName $fr.name -ResourceGroup $fr.resourceGroup -SubscriptionId $subId
        $subRaiPolicies += $raiPolicies.Count
        $hasEnterprise = ($raiPolicies | Where-Object { $_.name -eq 'enterprise-standard' }).Count -gt 0
        if ($hasEnterprise) { $subHasEnterprise = $true }

        Write-Host "  │  raiPolicies: $($raiPolicies.Count) (enterprise-standard: $hasEnterprise)"

        # 3. Check model deployments
        $deployments = Get-ModelDeployments -FoundryName $fr.name -ResourceGroup $fr.resourceGroup -SubscriptionId $subId
        $subTotalDeployments += $deployments.Count

        foreach ($dep in $deployments) {
            if ($dep.raiPolicy -eq 'enterprise-standard') {
                $subWithGuardrail++
            }
            else {
                $subMissingGuardrail++
                $currentPolicy = $(if ($dep.raiPolicy) { $dep.raiPolicy } else { 'none' })
                Write-Host "  │  ⚠ Deployment '$($dep.name)' ($($dep.model)) missing standard guardrail (has: $currentPolicy)" -ForegroundColor DarkYellow
            }
        }

        # 4. Per-resource detail record
        if ($IncludeResourceDetails) {
            $resourceRecord = [ordered]@{
                TimeGenerated      = $timestamp
                RecordType         = "ResourceDetail"
                SubscriptionId     = $subId
                SubscriptionName   = $subName
                ResourceName       = $fr.name
                ResourceGroup      = $fr.resourceGroup
                Location           = $fr.location
                RaiPoliciesCount   = $raiPolicies.Count
                RaiPolicyNames     = ($raiPolicies | ForEach-Object { $_.name }) -join ","
                HasEnterpriseStd   = $hasEnterprise
                DeploymentCount    = $deployments.Count
                DeploymentsGuarded = ($deployments | Where-Object { $_.raiPolicy -eq 'enterprise-standard' }).Count
                BusinessUnit       = $(if ($fr.tags.businessUnit) { $fr.tags.businessUnit } else { 'unknown' })
            }
            $null = $allRecords.Add($resourceRecord)
        }
    }

    # 5. Policy compliance summary
    $compliance = Get-PolicyComplianceForSubscription -SubscriptionId $subId
    $nonCompliantPolicies = @()
    if ($compliance.results.policyDetails) {
        $nonCompliantPolicies = $compliance.results.policyDetails |
            Where-Object { $_.complianceState -eq 'noncompliant' } |
            ForEach-Object { $_.policyDefinitionId }
    }

    $compliancePct = $(if ($subTotalDeployments -gt 0) {
        [math]::Round(($subWithGuardrail / $subTotalDeployments) * 100, 1)
    } else { 100 })

    $complianceState = $(if ($subMissingGuardrail -eq 0 -and $subHasEnterprise) { 'Compliant' }
        elseif ($subMissingGuardrail -gt 0) { 'NonCompliant' }
        else { 'PartiallyCompliant' })

    Write-Host "  └─ Compliance: $complianceState ($compliancePct% deployments guarded)" -ForegroundColor $(
        if ($complianceState -eq 'Compliant') { 'Green' }
        elseif ($complianceState -eq 'NonCompliant') { 'Red' }
        else { 'Yellow' }
    )

    $summaryRecord = [ordered]@{
        TimeGenerated               = $timestamp
        RecordType                  = "SubscriptionSummary"
        SubscriptionId              = $subId
        SubscriptionName            = $subName
        FoundryResourceCount        = $foundryResources.Count
        TotalDeployments            = $subTotalDeployments
        DeploymentsWithGuardrail    = $subWithGuardrail
        DeploymentsMissingGuardrail = $subMissingGuardrail
        RaiPoliciesCount            = $subRaiPolicies
        HasEnterpriseStandard       = $subHasEnterprise
        ComplianceState             = $complianceState
        CompliancePercentage        = $compliancePct
        NonCompliantPolicies        = ($nonCompliantPolicies -join ",")
    }
    $null = $allRecords.Add($summaryRecord)
}

# ─── Publish to Log Analytics ────────────────────────────────────────────────

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Publishing $($allRecords.Count) records to Log Analytics" -ForegroundColor Cyan
Write-Host "  Table: ${CustomTableName}_CL" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$jsonBody = $allRecords | ConvertTo-Json -Depth 10

if ($allRecords.Count -gt 0) {
    Send-LogAnalyticsData `
        -WorkspaceId $WorkspaceId `
        -WorkspaceKey $WorkspaceKey `
        -Body $jsonBody `
        -LogType $CustomTableName

    Write-Host "  Published successfully." -ForegroundColor Green
}
else {
    Write-Host "  No records to publish." -ForegroundColor Yellow
}

# ─── Summary Output ──────────────────────────────────────────────────────────

$totalSubs = $subscriptions.Count
$compliantSubs = ($allRecords | Where-Object { $_.RecordType -eq 'SubscriptionSummary' -and $_.ComplianceState -eq 'Compliant' }).Count
$nonCompliantSubs = ($allRecords | Where-Object { $_.RecordType -eq 'SubscriptionSummary' -and $_.ComplianceState -eq 'NonCompliant' }).Count

Write-Host ""
Write-Host "  ┌────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │  Enterprise RAI Compliance Summary      │" -ForegroundColor Cyan
Write-Host "  ├────────────────────────────────────────┤" -ForegroundColor Cyan
Write-Host "  │  Subscriptions scanned:  $totalSubs" -ForegroundColor White
Write-Host "  │  Fully compliant:        $compliantSubs" -ForegroundColor Green
Write-Host "  │  Non-compliant:          $nonCompliantSubs" -ForegroundColor $(if ($nonCompliantSubs -gt 0) { 'Red' } else { 'Green' })
Write-Host "  │  Data target:            ${CustomTableName}_CL" -ForegroundColor White
Write-Host "  └────────────────────────────────────────┘" -ForegroundColor Cyan

Write-Host ""
Write-Host "  Dashboard query (KQL):" -ForegroundColor White
Write-Host @"
    ${CustomTableName}_CL
    | where RecordType_s == "SubscriptionSummary"
    | summarize
        TotalFoundryResources = sum(FoundryResourceCount_d),
        TotalDeployments = sum(TotalDeployments_d),
        GuardedDeployments = sum(DeploymentsWithGuardrail_d),
        UnguardedDeployments = sum(DeploymentsMissingGuardrail_d)
      by bin(TimeGenerated, 1h)
    | render timechart
"@ -ForegroundColor DarkGray
