param(
  [string]$PstPath = "C:\Users\Workstation 2\Desktop\PSG Rebrand\Outlook.pst",
  [string]$OutputDir = "C:\Users\Workstation 2\Desktop\PSG Rebrand\artifacts\pst_extract",
  [int]$MonthsBack = 3
)

$ErrorActionPreference = 'Stop'

function Load-BranchNames {
  param([string]$SeedSqlPath)
  $content = Get-Content -Path $SeedSqlPath -Raw
  $matches = [regex]::Matches($content, "\('psg-[0-9]{3}','([^']+)'", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $names = @()
  foreach ($m in $matches) { $names += $m.Groups[1].Value }
  return $names | Select-Object -Unique
}

function Safe-FileName {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return 'untitled' }
  $invalid = [System.IO.Path]::GetInvalidFileNameChars() -join ''
  $safe = $Value -replace "[$([regex]::Escape($invalid))]", '-'
  $safe = $safe -replace '\s+', ' '
  $safe = $safe.Trim()
  if ($safe.Length -gt 120) { $safe = $safe.Substring(0, 120) }
  if ([string]::IsNullOrWhiteSpace($safe)) { return 'untitled' }
  return $safe
}

function Find-TargetFolders {
  param($Root)
  $targets = New-Object System.Collections.Generic.List[object]

  function Visit($folder, $targetsRef) {
    $name = $folder.Name.ToLowerInvariant()
    if ($name -eq 'inbox' -or $name -eq 'sent items' -or $name -eq 'sent') {
      $targetsRef.Add($folder)
    }
    foreach ($child in $folder.Folders) {
      Visit $child $targetsRef
    }
  }

  foreach ($folder in $Root.Folders) {
    Visit $folder $targets
  }

  return $targets | Select-Object -Unique
}

function Process-Folder {
  param(
    $Folder,
    [DateTime]$Cutoff,
    [string[]]$BranchNames,
    [string]$OutputDir,
    [string]$JsonlPath,
    [hashtable]$Summary,
    [ref]$MailCounter
  )

  $folderName = $Folder.Name.ToLowerInvariant()
  $isSent = $folderName.Contains('sent')
  $dateField = if ($isSent) { 'SentOn' } else { 'ReceivedTime' }
  $cutoffFilter = $Cutoff.ToString('g')

  $items = $Folder.Items
  $items.Sort("[$dateField]", $true)
  $restricted = $items.Restrict("[$dateField] >= '$cutoffFilter'")

  foreach ($item in $restricted) {
    try {
      if ($item.Class -ne 43) { continue }

      $mailDate = if ($isSent) { [DateTime]$item.SentOn } else { [DateTime]$item.ReceivedTime }
      if ($mailDate -lt $Cutoff) { continue }

      $subject = [string]$item.Subject
      $body = [string]$item.Body
      $text = ($subject + "`n" + $body).ToLowerInvariant()

      $hasPsg = $text.Contains('psg')
      $matched = @()
      foreach ($branch in $BranchNames) {
        if ($text.Contains($branch.ToLowerInvariant())) {
          $matched += $branch
        }
      }

      if (-not $hasPsg -and $matched.Count -eq 0) { continue }

      $MailCounter.Value++
      $mailKey = "mail-{0:000000}" -f $MailCounter.Value
      $mailDir = Join-Path $OutputDir $mailKey
      New-Item -ItemType Directory -Path $mailDir -Force | Out-Null

      $attachments = @()
      if ($item.Attachments.Count -gt 0) {
        for ($i = 1; $i -le $item.Attachments.Count; $i++) {
          $att = $item.Attachments.Item($i)
          $fileName = Safe-FileName -Value $att.FileName
          $target = Join-Path $mailDir $fileName
          $att.SaveAsFile($target)
          $attachments += $target
        }
      }

      foreach ($branchName in $matched) {
        if (-not $Summary.ContainsKey($branchName)) {
          $Summary[$branchName] = 0
        }
        $Summary[$branchName]++
      }

      $record = [ordered]@{
        mailKey = $mailKey
        folderPath = [string]$Folder.FolderPath
        isSent = $isSent
        date = $mailDate.ToString('o')
        subject = $subject
        senderName = [string]$item.SenderName
        senderEmail = [string]$item.SenderEmailAddress
        recipientsTo = [string]$item.To
        recipientsCc = [string]$item.CC
        matchedBranches = $matched
        hasPsgKeyword = $hasPsg
        bodyPreview = if ($body.Length -gt 1500) { $body.Substring(0, 1500) } else { $body }
        attachments = $attachments
      }

      ($record | ConvertTo-Json -Depth 5 -Compress) | Add-Content -Path $JsonlPath -Encoding UTF8

      if (($MailCounter.Value % 100) -eq 0) {
        Write-Output "Processed $($MailCounter.Value) matched emails..."
      }
    } catch {
      continue
    }
  }

  foreach ($sub in $Folder.Folders) {
    Process-Folder -Folder $sub -Cutoff $Cutoff -BranchNames $BranchNames -OutputDir $OutputDir -JsonlPath $JsonlPath -Summary $Summary -MailCounter ([ref]$MailCounter.Value)
  }
}

if (-not (Test-Path $PstPath)) { throw "PST not found: $PstPath" }

$seedPath = "C:\Users\Workstation 2\Desktop\PSG Rebrand\supabase\seed-branches.sql"
if (-not (Test-Path $seedPath)) { throw "Missing branch seed file: $seedPath" }

if (Test-Path $OutputDir) {
  Remove-Item -Path (Join-Path $OutputDir '*') -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$jsonlPath = Join-Path $OutputDir 'psg_emails_last_3_months.jsonl'
if (Test-Path $jsonlPath) { Remove-Item $jsonlPath -Force }

$cutoff = (Get-Date).AddMonths(-$MonthsBack)
$branchNames = Load-BranchNames -SeedSqlPath $seedPath
$summary = @{}
$mailCounter = 0

$outlook = $null
$namespace = $null

try {
  $outlook = New-Object -ComObject Outlook.Application
  $namespace = $outlook.GetNamespace('MAPI')
  $namespace.AddStore($PstPath)

  $store = $null
  foreach ($s in $namespace.Stores) {
    if ([string]$s.FilePath -eq $PstPath) { $store = $s; break }
  }
  if ($null -eq $store) { throw "Cannot open PST store" }

  $targets = Find-TargetFolders -Root $store.GetRootFolder()
  Write-Output "Scanning $($targets.Count) Inbox/Sent folders (incl. nested)..."

  foreach ($folder in $targets) {
    Write-Output "Scanning folder: $($folder.FolderPath)"
    Process-Folder -Folder $folder -Cutoff $cutoff -BranchNames $branchNames -OutputDir $OutputDir -JsonlPath $jsonlPath -Summary $summary -MailCounter ([ref]$mailCounter)
  }

  $jsonArrayPath = Join-Path $OutputDir 'psg_emails_last_3_months.json'
  $all = @()
  Get-Content -Path $jsonlPath | ForEach-Object { if ($_.Trim()) { $all += ($_ | ConvertFrom-Json) } }
  $all | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonArrayPath -Encoding UTF8

  $summaryRows = $summary.GetEnumerator() | Sort-Object Name | ForEach-Object {
    [PSCustomObject]@{ branch = $_.Key; emailCount = $_.Value }
  }
  $summaryRows | Export-Csv -Path (Join-Path $OutputDir 'branch_email_summary.csv') -NoTypeInformation -Encoding UTF8

  Write-Output "DONE. Extracted $mailCounter matched emails since $($cutoff.ToString('yyyy-MM-dd'))."
  Write-Output "JSON: $jsonArrayPath"
} finally {
  if ($namespace -ne $null) {
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($namespace) | Out-Null
  }
  if ($outlook -ne $null) {
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
