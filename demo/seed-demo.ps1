<#
  Prepares a realistic demo tenant for recording, in one command.

  Creates "Al Madina Grocers" with believable stock (one item already
  below its reorder level), a main supplier and a registered backup, then
  runs the real AI agents to produce a genuine alert and contingency plan.

  Usage (from the repo root, with both services running):
      pwsh demo/seed-demo.ps1
      pwsh demo/seed-demo.ps1 -Reset     # wipe the demo tenant and re-seed
#>

param(
    [switch]$Reset,
    [string]$ApiUrl = "http://localhost:4000",
    [string]$ServiceToken = "dev-only-shared-token-change-me",
    [string]$BusinessName = "Al Madina Grocers"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Psql([string]$Sql) {
    docker exec ignyty-hackathone-postgres-1 psql -U scdt -d scdt -t -A -c $Sql
}

function Remove-DemoTenant {
    $ids = Invoke-Psql "SELECT id FROM tenants WHERE business_name = '$BusinessName';"
    foreach ($id in ($ids -split "`n" | Where-Object { $_.Trim() })) {
        $t = $id.Trim()
        Invoke-Psql @"
DELETE FROM recommendations WHERE alert_id IN (SELECT id FROM alerts WHERE tenant_id='$t');
DELETE FROM alerts WHERE tenant_id='$t';
DELETE FROM disruption_predictions WHERE tenant_id='$t';
DELETE FROM auto_trigger_rules WHERE tenant_id='$t';
DELETE FROM order_line_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id='$t');
DELETE FROM orders WHERE tenant_id='$t';
DELETE FROM inventory_items WHERE tenant_id='$t';
DELETE FROM suppliers WHERE tenant_id='$t';
DELETE FROM data_sources WHERE tenant_id='$t';
DELETE FROM audit_log_entries WHERE tenant_id='$t';
DELETE FROM users WHERE tenant_id='$t';
DELETE FROM tenants WHERE id='$t';
"@ | Out-Null
        Write-Host "  removed previous demo tenant $t"
    }
}

if ($Reset) {
    Write-Host "Resetting demo data..." -ForegroundColor Yellow
    Remove-DemoTenant
} else {
    Remove-DemoTenant
}

Write-Host "`nSeeding demo tenant..." -ForegroundColor Cyan
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$tenant = Invoke-RestMethod -Uri "$ApiUrl/tenants" -Method Post -WebSession $session `
    -ContentType "application/json" -Body (@{
        business_name        = $BusinessName
        sector               = "food"
        owner_email_or_phone = "owner@almadina.ae"
    } | ConvertTo-Json)
Write-Host "  business: $($tenant.business_name)"

Invoke-RestMethod -Uri "$ApiUrl/auth/dev-login" -Method Post -WebSession $session `
    -ContentType "application/json" -Body (@{ userId = $tenant.owner_user_id } | ConvertTo-Json) | Out-Null

Invoke-RestMethod -Uri "$ApiUrl/tenants/me/ai-consent" -Method Post -WebSession $session | Out-Null
Write-Host "  smart alerts: enabled"

# One item deliberately below its reorder level, so the dashboard shows a
# "Low" flag on camera.
$stock = @(
    @{ sku = "RICE-10";  name = "Basmati Rice 10kg";      quantity_on_hand = 48; reorder_threshold = 20 },
    @{ sku = "OIL-5L";   name = "Sunflower Oil 5L";       quantity_on_hand = 14; reorder_threshold = 25 },
    @{ sku = "SUGAR-5";  name = "White Sugar 5kg";        quantity_on_hand = 62; reorder_threshold = 20 },
    @{ sku = "FLOUR-10"; name = "All-Purpose Flour 10kg"; quantity_on_hand = 36; reorder_threshold = 15 },
    @{ sku = "TEA-500";  name = "Black Tea 500g";         quantity_on_hand = 90; reorder_threshold = 30 }
)
foreach ($item in $stock) {
    Invoke-RestMethod -Uri "$ApiUrl/inventory-items" -Method Post -WebSession $session `
        -ContentType "application/json" -Body ($item | ConvertTo-Json) | Out-Null
}
Write-Host "  stock: $($stock.Count) items (1 below reorder level)"

$primary = Invoke-RestMethod -Uri "$ApiUrl/suppliers" -Method Post -WebSession $session `
    -ContentType "application/json" -Body (@{
        name = "Gulf Wholesale Trading"; kind = "primary"
        location = "Dubai"; typical_lead_time_days = 4
    } | ConvertTo-Json)

Invoke-RestMethod -Uri "$ApiUrl/suppliers" -Method Post -WebSession $session `
    -ContentType "application/json" -Body (@{
        name = "Desert Star Supplies"; kind = "backup"
        location = "Sharjah"; typical_lead_time_days = 3
    } | ConvertTo-Json) | Out-Null
Write-Host "  suppliers: Gulf Wholesale Trading (main), Desert Star Supplies (backup)"

$item = (Invoke-RestMethod -Uri "$ApiUrl/inventory-items" -WebSession $session |
         Where-Object { $_.sku -eq "OIL-5L" })

Write-Host "`nRunning the real AI agents (this calls the live model)..." -ForegroundColor Cyan
Push-Location "$repoRoot/apps/ai-service"
$env:PYTHONPATH = "$repoRoot/apps/ai-service"
# NOTE: property access must be wrapped in $() in PowerShell argument
# position — `$tenant.id` there is parsed as the object followed by the
# literal ".id", not as the property.
& ".\.venv\Scripts\python.exe" scripts/seed_disruption.py `
    --tenant-id "$($tenant.id)" `
    --supplier-id "$($primary.id)" `
    --supplier-name "Gulf Wholesale Trading" `
    --item-id "$($item.id)" | Select-Object -Last 2
Pop-Location

$ownerId = (Invoke-Psql "SELECT id FROM users WHERE tenant_id='$($tenant.id)' AND role='owner';").Trim()

$rule = "=" * 60
Write-Host "`n$rule" -ForegroundColor Green
Write-Host " Demo ready" -ForegroundColor Green
Write-Host $rule -ForegroundColor Green
Write-Host " Open:  http://localhost:3000"
Write-Host ""
Write-Host " To sign in as the owner, paste this in the"
Write-Host " browser console (F12) once, then refresh:"
Write-Host ""
Write-Host "   await fetch('$ApiUrl/auth/dev-login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'$ownerId'})})" -ForegroundColor Yellow
Write-Host ""
Write-Host " Re-run with -Reset to start over."
Write-Host $rule -ForegroundColor Green
