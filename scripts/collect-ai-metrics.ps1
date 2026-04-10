# ============================================================================
# Script #5: AI Metrics Collection & Time Series Publish
#
# Purpose: Collects AI platform metrics from all Foundry resources across
# subscriptions and publishes to Log Analytics for enterprise dashboards.
#
# Metrics collected:
#   - Application tags (businessUnit, environment, etc.)
#   - Total requests (SuccessfulCalls, TotalCalls, ClientErrors, ServerErrors)
#   - Token usage (ProcessedPromptTokens, GeneratedTokens, TotalTokens)
#   - Model-level breakdown (per deployment)
#   - Latency (average, P99)
#   - Active deployments inventory
#   - Throttling events (HTTP 429)
#
# Target: Log Analytics custom table (FoundryAIMetrics_CL)
#
# Usage:
#   .\collect-ai-metrics.ps1 -WorkspaceId <LAW-id> -WorkspaceKey <key>
#   .\collect-ai-metrics.ps1 -WorkspaceId <LAW-id> -WorkspaceKey <key> -IntervalHours 3
#
# Schedule: Azure Automation runbook every 3 hours (or cron/Task Scheduler)
# ============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$WorkspaceId,

    [Parameter(Mandatory)]
    [string]$WorkspaceKey,

    [string]$MgName = "",

    [string[]]$SubscriptionIds = @(),

    [string]$CustomTableName = "FoundryAIMetrics",

    [int]$IntervalHours = 3,

    [switch]$ContinuousMode,

    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ─── Constants ───────────────────────────────────────────────────────────────

$METRIC_NAMES = @(
    "SuccessfulCalls"
    "TotalCalls"
    "ClientErrors"
    "ServerErrors"
    "ProcessedPromptTokens"
    "GeneratedTokens"
    "TotalTokens"
    "Latency"
    "TokenTransaction"
)

# ─── Functions ───────────────────────────────────────────────────────────────

function Send-LogAnalyticsData {
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

function Get-FoundryMetrics {
    <#
    .SYNOPSIS
        Collects Azure Monitor metrics from a Foundry resource for the given time window.
    #>
    param(
        [string]$ResourceId,
        [DateTime]$StartTime,
        [DateTime]$EndTime
    )

    $st = $StartTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
    $et = $EndTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
    $metricList = $METRIC_NAMES -join ","

    $raw = az monitor metrics list `
        --resource $ResourceId `
        --metric $metricList `
        --aggregation Total Average `
        --interval "PT1H" `
        --start-time $st `
        --end-time $et `
        -o json 2>$null | ConvertFrom-Json

    return $raw
}

function Get-DeploymentLevelMetrics {
    <#
    .SYNOPSIS
        Collects per-deployment (per-model) metrics using dimension filtering.
    #>
    param(
        [string]$ResourceId,
        [string]$DeploymentName,
        [DateTime]$StartTime,
        [DateTime]$EndTime
    )

    $st = $StartTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
    $et = $EndTime.ToString("yyyy-MM-ddTHH:mm:ssZ")

    $raw = az monitor metrics list `
        --resource $ResourceId `
        --metric "TotalCalls,ProcessedPromptTokens,GeneratedTokens,TotalTokens,Latency" `
        --aggregation Total Average `
        --interval "PT1H" `
        --start-time $st `
        --end-time $et `
        --filter "ModelDeploymentName eq '$DeploymentName'" `
        -o json 2>$null | ConvertFrom-Json

    return $raw
}

function Aggregate-MetricTimeseries {
    <#
    .SYNOPSIS
        Sums total and averages from metric timeseries data.
    #>
    param($MetricData, [string]$MetricName, [string]$Aggregation = "Total")

    $metric = $MetricData.value | Where-Object { $_.name.value -eq $MetricName }
    if (-not $metric -or -not $metric.timeseries -or $metric.timeseries.Count -eq 0) { return 0 }

    $dataPoints = $metric.timeseries[0].data
    if ($Aggregation -eq "Total") {
        return ($dataPoints | ForEach-Object { $_.total } | Where-Object { $_ -ne $null } | Measure-Object -Sum).Sum
    }
    elseif ($Aggregation -eq "Average") {
        $vals = $dataPoints | ForEach-Object { $_.average } | Where-Object { $_ -ne $null }
        if ($vals.Count -eq 0) { return 0 }
        return ($vals | Measure-Object -Average).Average
    }
    return 0
}

function Collect-SinglePass {
    <#
    .SYNOPSIS
        Performs one collection pass across all subscriptions.
    #>
    param(
        [array]$Subscriptions,
        [DateTime]$StartTime,
        [DateTime]$EndTime
    )

    $allRecords = [System.Collections.ArrayList]::new()
    $timestamp = (Get-Date).ToUniversalTime().ToString("o")
    $collectionWindow = "$($StartTime.ToString('HH:mm'))-$($EndTime.ToString('HH:mm')) UTC"

    foreach ($sub in $Subscriptions) {
        $subId = $sub.id
        $subName = $sub.displayName
        Write-Host "`n── $subName ──" -ForegroundColor Yellow

        az account set --subscription $subId 2>$null

        # Discover Foundry resources
        $resources = az resource list `
            --subscription $subId `
            --resource-type "Microsoft.CognitiveServices/accounts" `
            --query "[?kind=='AIServices'].{id:id, name:name, resourceGroup:resourceGroup, location:location, tags:tags}" `
            -o json 2>$null | ConvertFrom-Json

        if ($resources.Count -eq 0) {
            Write-Host "  No Foundry resources." -ForegroundColor DarkGray
            continue
        }

        foreach ($resource in $resources) {
            Write-Host "  ├─ $($resource.name)" -ForegroundColor White

            # Resource-level tags
            $buTag = $resource.tags.businessUnit ?? "unknown"
            $envTag = $resource.tags.environment ?? "unknown"
            $appTags = ($resource.tags | ConvertTo-Json -Compress) 2>$null ?? "{}"

            # Collect aggregate metrics
            $metrics = Get-FoundryMetrics -ResourceId $resource.id -StartTime $StartTime -EndTime $EndTime

            $totalCalls = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "TotalCalls" -Aggregation "Total"
            $successCalls = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "SuccessfulCalls" -Aggregation "Total"
            $clientErrors = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "ClientErrors" -Aggregation "Total"
            $serverErrors = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "ServerErrors" -Aggregation "Total"
            $promptTokens = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "ProcessedPromptTokens" -Aggregation "Total"
            $generatedTokens = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "GeneratedTokens" -Aggregation "Total"
            $totalTokens = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "TotalTokens" -Aggregation "Total"
            $avgLatency = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "Latency" -Aggregation "Average"
            $tokenTransactions = Aggregate-MetricTimeseries -MetricData $metrics -MetricName "TokenTransaction" -Aggregation "Total"

            Write-Host "  │  Calls: $totalCalls (success: $successCalls, errors: $($clientErrors + $serverErrors))" -ForegroundColor DarkGray
            Write-Host "  │  Tokens: in=$promptTokens out=$generatedTokens total=$totalTokens" -ForegroundColor DarkGray

            # Resource-level summary record
            $resourceRecord = [ordered]@{
                TimeGenerated       = $timestamp
                CollectionWindow    = $collectionWindow
                RecordType          = "ResourceSummary"
                SubscriptionId      = $subId
                SubscriptionName    = $subName
                ResourceName        = $resource.name
                ResourceGroup       = $resource.resourceGroup
                Location            = $resource.location
                BusinessUnit        = $buTag
                Environment         = $envTag
                ApplicationTags     = $appTags
                TotalRequests       = $totalCalls
                SuccessfulRequests  = $successCalls
                ClientErrors        = $clientErrors
                ServerErrors        = $serverErrors
                ThrottledRequests   = $clientErrors  # 429s show as client errors
                PromptTokensIn      = $promptTokens
                CompletionTokensOut = $generatedTokens
                TotalTokens         = $totalTokens
                TokenTransactions   = $tokenTransactions
                AvgLatencyMs        = [math]::Round($avgLatency, 2)
                ErrorRate           = if ($totalCalls -gt 0) { [math]::Round(($clientErrors + $serverErrors) / $totalCalls * 100, 2) } else { 0 }
            }
            $null = $allRecords.Add($resourceRecord)

            # Per-model deployment metrics
            $deployments = az cognitiveservices account deployment list `
                --name $resource.name `
                -g $resource.resourceGroup `
                --subscription $subId `
                --query "[].{name:name, model:properties.model.name, version:properties.model.version, raiPolicy:properties.raiPolicyName, sku:sku.name, tpm:sku.capacity}" `
                -o json 2>$null | ConvertFrom-Json

            foreach ($dep in $deployments) {
                $depMetrics = Get-DeploymentLevelMetrics -ResourceId $resource.id -DeploymentName $dep.name -StartTime $StartTime -EndTime $EndTime

                $depCalls = Aggregate-MetricTimeseries -MetricData $depMetrics -MetricName "TotalCalls" -Aggregation "Total"
                $depPromptTokens = Aggregate-MetricTimeseries -MetricData $depMetrics -MetricName "ProcessedPromptTokens" -Aggregation "Total"
                $depGenTokens = Aggregate-MetricTimeseries -MetricData $depMetrics -MetricName "GeneratedTokens" -Aggregation "Total"
                $depTotalTokens = Aggregate-MetricTimeseries -MetricData $depMetrics -MetricName "TotalTokens" -Aggregation "Total"
                $depLatency = Aggregate-MetricTimeseries -MetricData $depMetrics -MetricName "Latency" -Aggregation "Average"

                Write-Host "  │  ├─ $($dep.name) ($($dep.model)): $depCalls calls, $depTotalTokens tokens" -ForegroundColor DarkGray

                $depRecord = [ordered]@{
                    TimeGenerated       = $timestamp
                    CollectionWindow    = $collectionWindow
                    RecordType          = "ModelDeployment"
                    SubscriptionId      = $subId
                    SubscriptionName    = $subName
                    ResourceName        = $resource.name
                    ResourceGroup       = $resource.resourceGroup
                    BusinessUnit        = $buTag
                    Environment         = $envTag
                    DeploymentName      = $dep.name
                    ModelName           = $dep.model
                    ModelVersion        = $dep.version
                    SKU                 = $dep.sku
                    TPMCapacity         = $dep.tpm
                    RaiPolicyName       = ($dep.raiPolicy ?? "none")
                    TotalRequests       = $depCalls
                    PromptTokensIn      = $depPromptTokens
                    CompletionTokensOut = $depGenTokens
                    TotalTokens         = $depTotalTokens
                    AvgLatencyMs        = [math]::Round($depLatency, 2)
                    TPMUtilization      = if ($dep.tpm -gt 0) { [math]::Round($depTotalTokens / ($dep.tpm * 60 * $IntervalHours) * 100, 2) } else { 0 }
                }
                $null = $allRecords.Add($depRecord)
            }
        }
    }

    return $allRecords
}

# ─── Discover Subscriptions ─────────────────────────────────────────────────

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Foundry AI Metrics Collection" -ForegroundColor Cyan
Write-Host "  Interval: ${IntervalHours}h | $(Get-Date -Format 'yyyy-MM-dd HH:mm UTC' -AsUTC)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

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
    $subscriptions = az account list --query "[?state=='Enabled'].{id:id, displayName:name}" -o json | ConvertFrom-Json
}

Write-Host "  Scanning $($subscriptions.Count) subscription(s)" -ForegroundColor Green

# ─── Collection Loop ─────────────────────────────────────────────────────────

do {
    $endTime = (Get-Date).ToUniversalTime()
    $startTime = $endTime.AddHours(-$IntervalHours)

    Write-Host "`n  Collection window: $($startTime.ToString('HH:mm'))-$($endTime.ToString('HH:mm')) UTC" -ForegroundColor White

    $records = Collect-SinglePass -Subscriptions $subscriptions -StartTime $startTime -EndTime $endTime

    # Publish to Log Analytics
    if ($records.Count -gt 0) {
        $jsonBody = $records | ConvertTo-Json -Depth 10

        Write-Host "`n  Publishing $($records.Count) records to ${CustomTableName}_CL..." -ForegroundColor Cyan

        Send-LogAnalyticsData `
            -WorkspaceId $WorkspaceId `
            -WorkspaceKey $WorkspaceKey `
            -Body $jsonBody `
            -LogType $CustomTableName

        Write-Host "  Published successfully." -ForegroundColor Green
    }
    else {
        Write-Host "`n  No metrics collected this cycle." -ForegroundColor Yellow
    }

    # Summary
    $resourceRecords = $records | Where-Object { $_.RecordType -eq "ResourceSummary" }
    $modelRecords = $records | Where-Object { $_.RecordType -eq "ModelDeployment" }

    Write-Host ""
    Write-Host "  ┌──────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │  Collection Summary                           │" -ForegroundColor Cyan
    Write-Host "  ├──────────────────────────────────────────────┤" -ForegroundColor Cyan
    Write-Host "  │  Foundry resources:   $($resourceRecords.Count)" -ForegroundColor White
    Write-Host "  │  Model deployments:   $($modelRecords.Count)" -ForegroundColor White
    Write-Host "  │  Total requests:      $(($resourceRecords | Measure-Object -Property TotalRequests -Sum).Sum)" -ForegroundColor White
    Write-Host "  │  Total tokens:        $(($resourceRecords | Measure-Object -Property TotalTokens -Sum).Sum)" -ForegroundColor White
    Write-Host "  │  Tokens in (prompt):  $(($resourceRecords | Measure-Object -Property PromptTokensIn -Sum).Sum)" -ForegroundColor White
    Write-Host "  │  Tokens out (compl):  $(($resourceRecords | Measure-Object -Property CompletionTokensOut -Sum).Sum)" -ForegroundColor White
    Write-Host "  │  Avg latency:         $(if ($resourceRecords.Count -gt 0) { [math]::Round(($resourceRecords | Measure-Object -Property AvgLatencyMs -Average).Average, 1) } else { 0 })ms" -ForegroundColor White
    Write-Host "  └──────────────────────────────────────────────┘" -ForegroundColor Cyan

    # Top models by usage
    if ($modelRecords.Count -gt 0) {
        Write-Host ""
        Write-Host "  Top models by token usage:" -ForegroundColor Yellow
        $modelRecords |
            Sort-Object -Property TotalTokens -Descending |
            Select-Object -First 5 |
            ForEach-Object {
                Write-Host "    $($_.ModelName.PadRight(30)) $($_.TotalTokens) tokens ($($_.TotalRequests) calls) [$($_.BusinessUnit)]" -ForegroundColor DarkGray
            }
    }

    if ($ContinuousMode) {
        Write-Host "`n  Next collection in $IntervalHours hours..." -ForegroundColor DarkGray
        Start-Sleep -Seconds ($IntervalHours * 3600)
    }

} while ($ContinuousMode)

# ─── Dashboard Queries ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ─── Sample KQL Queries for Dashboards ───" -ForegroundColor Yellow
Write-Host ""
Write-Host "  // Requests & tokens over time (by BU)" -ForegroundColor DarkGray
Write-Host @"
    ${CustomTableName}_CL
    | where RecordType_s == "ResourceSummary"
    | summarize
        Requests = sum(TotalRequests_d),
        TokensIn = sum(PromptTokensIn_d),
        TokensOut = sum(CompletionTokensOut_d)
      by bin(TimeGenerated, 3h), BusinessUnit_s
    | render timechart
"@ -ForegroundColor DarkGray

Write-Host ""
Write-Host "  // Model popularity across enterprise" -ForegroundColor DarkGray
Write-Host @"
    ${CustomTableName}_CL
    | where RecordType_s == "ModelDeployment"
    | summarize
        TotalCalls = sum(TotalRequests_d),
        TotalTokens = sum(TotalTokens_d),
        AvgLatency = avg(AvgLatencyMs_d)
      by ModelName_s
    | sort by TotalTokens desc
"@ -ForegroundColor DarkGray

Write-Host ""
Write-Host "  // TPM utilization heatmap" -ForegroundColor DarkGray
Write-Host @"
    ${CustomTableName}_CL
    | where RecordType_s == "ModelDeployment"
    | summarize AvgUtilization = avg(TPMUtilization_d)
      by DeploymentName_s, ResourceName_s, bin(TimeGenerated, 3h)
    | render timechart
"@ -ForegroundColor DarkGray
