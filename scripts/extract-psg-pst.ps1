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
  $names = New-Object System.Collections.Generic.List[string]
  foreach ($m in $matches) {
    $names.Add($m.Groups[1].Value)
  }

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

function Folder-Matches {
  param($Folder)
  $name = $Folder.Name.ToLowerInvariant()
  return $name -eq 'inbox' -or $name -eq 'sent items' -or $name -eq 'sent'
}

function Find-Folders {
  param($RootFolder)

  $result = New-Object System.Collections.Generic.List[object]

  foreach ($child in $RootFolder.Folders) {
    if (Folder-Matches -Folder $child) {
      $result.Add($child)
    }

    $nested = Find-Folders -RootFolder $child
    foreach ($item in $nested) {
      if (Folder-Matches -Folder $item) {
        $result.Add($item)
      }
    }
  }

  return $result
}

function Scan-Folder {
  param(
    $Folder,
    [DateTime]$Cutoff,
    [string[]]$BranchNames,
    [string]$OutputDir,
    [System.Collections.Generic.List[object]]$Rows,
    [ref]$Counter
  )

  foreach ($item in $Folder.Items) {
    try {
      if ($item.Class -ne 43) { continue }

      $isSentFolder = $Folder.Name.ToLowerInvariant().Contains('sent')
      $mailDate = if ($isSentFolder) { [DateTime]$item.SentOn } else { [DateTime]$item.ReceivedTime }
      if ($mailDate -lt $Cutoff) { continue }

      $subject = [string]$item.Subject
      $body = [string]$item.Body
      $text = ($subject + "`n" + $body).ToLowerInvariant()

      $hasPsg = $text.Contains('psg')
      $matchedBranches = @()
      foreach ($branchName in $BranchNames) {
        if ($text.Contains($branchName.ToLowerInvariant())) {
          $matchedBranches += $branchName
        }
      }

      if (-not $hasPsg -and $matchedBranches.Count -eq 0) { continue }

      $Counter.Value++
      $mailKey = "mail-{0:000000}" -f $Counter.Value
      $mailDir = Join-Path $OutputDir $mailKey
      New-Item -ItemType Directory -Path $mailDir -Force | Out-Null

      $savedAttachments = @()
      if ($item.Attachments.Count -gt 0) {
        for ($i = 1; $i -le $item.Attachments.Count; $i++) {
          $att = $item.Attachments.Item($i)
          $fileName = Safe-FileName -Value $att.FileName
          $targetPath = Join-Path $mailDir $fileName
          $att.SaveAsFile($targetPath)
          $savedAttachments += $targetPath
        }
      }

      $rowsItem = [PSCustomObject]@{
        mailKey = $mailKey
        folderPath = [string]$Folder.FolderPath
        isSent = $isSentFolder
        date = $mailDate.ToString('o')
        subject = $subject
        senderName = [string]$item.SenderName
        senderEmail = [string]$item.SenderEmailAddress
        recipientsTo = [string]$item.To
        recipientsCc = [string]$item.CC
        matchedBranches = $matchedBranches
        hasPsgKeyword = $hasPsg
        bodyPreview = if ($body.Length -gt 1200) { $body.Substring(0, 1200) } else { $body }
        attachments = $savedAttachments
      }

      $Rows.Add($rowsItem)
    } catch {
      continue
    }
  }

  foreach ($sub in $Folder.Folders) {
    Scan-Folder -Folder $sub -Cutoff $Cutoff -BranchNames $BranchNames -OutputDir $OutputDir -Rows $Rows -Counter ([ref]$Counter.Value)
  }
}

if (-not (Test-Path $PstPath)) {
  throw "PST not found at $PstPath"
}

$seedPath = "C:\Users\Workstation 2\Desktop\PSG Rebrand\supabase\seed-branches.sql"
if (-not (Test-Path $seedPath)) {
  throw "Seed branch file not found at $seedPath"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$branchNames = Load-BranchNames -SeedSqlPath $seedPath
$cutoffDate = (Get-Date).AddMonths(-$MonthsBack)

$outlook = $null
$namespace = $null

try {
  $outlook = New-Object -ComObject Outlook.Application
  $namespace = $outlook.GetNamespace('MAPI')
  $namespace.AddStore($PstPath)

  $store = $null
  foreach ($s in $namespace.Stores) {
    if ([string]$s.FilePath -eq $PstPath) {
      $store = $s
      break
    }
  }

  if ($null -eq $store) {
    throw "Unable to access store for PST: $PstPath"
  }

  $root = $store.GetRootFolder()
  $targetFolders = Find-Folders -RootFolder $root | Select-Object -Unique

  $rows = New-Object System.Collections.Generic.List[object]
  $counter = 0

  foreach ($folder in $targetFolders) {
    Scan-Folder -Folder $folder -Cutoff $cutoffDate -BranchNames $branchNames -OutputDir $OutputDir -Rows $rows -Counter ([ref]$counter)
  }

  $rowsPath = Join-Path $OutputDir 'psg_emails_last_3_months.json'
  $rows | ConvertTo-Json -Depth 6 | Set-Content -Path $rowsPath -Encoding UTF8

  $summary = $rows |
    ForEach-Object { $_.matchedBranches } |
    ForEach-Object { $_ } |
    Group-Object |
    Sort-Object Count -Descending |
    Select-Object @{Name='branch';Expression={$_.Name}}, @{Name='emailCount';Expression={$_.Count}}

  $summaryPath = Join-Path $OutputDir 'branch_email_summary.csv'
  $summary | Export-Csv -Path $summaryPath -NoTypeInformation -Encoding UTF8

  Write-Output "Extracted $($rows.Count) PSG-related emails since $($cutoffDate.ToString('yyyy-MM-dd'))."
  Write-Output "JSON: $rowsPath"
  Write-Output "Summary: $summaryPath"
} finally {
  if ($namespace -ne $null) {
    try { $namespace.RemoveStore(($namespace.Stores | Where-Object { [string]$_.FilePath -eq $PstPath } | Select-Object -First 1).GetRootFolder()) } catch {}
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($namespace) | Out-Null
  }

  if ($outlook -ne $null) {
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
