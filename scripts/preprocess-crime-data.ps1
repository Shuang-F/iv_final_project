$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$csvPath = Join-Path $root "Crimes_-_2025_20260426.csv"
$outputDir = Join-Path $root "data\\processed"

if (-not (Test-Path $csvPath)) {
    throw "CSV file not found at $csvPath"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$rows = Import-Csv $csvPath

$validRows = $rows | Where-Object {
    $_.District -ne "" -and
    $_."Primary Type" -ne "" -and
    $_.Date -ne ""
}

$districtCentroids = @{}
$cube = @{}
$monthlyTotals = @{}
$crimeTotals = @{}
$districtTotals = @{}
$locationTotals = @{}
$overview = [ordered]@{
    totalRecords = 0
    mappedRecords = 0
    arrestRecords = 0
    domesticRecords = 0
}

foreach ($row in $validRows) {
    $overview.totalRecords += 1

    $district = $row.District.Trim()
    $crimeType = $row."Primary Type".Trim()
    $location = $row."Location Description".Trim()
    $isArrest = ($row.Arrest -eq "true")
    $isDomestic = ($row.Domestic -eq "true")

    $dt = [datetime]::Parse($row.Date)
    $month = $dt.Month

    if ($isArrest) { $overview.arrestRecords += 1 }
    if ($isDomestic) { $overview.domesticRecords += 1 }

    if (-not $monthlyTotals.ContainsKey($month)) {
        $monthlyTotals[$month] = 0
    }
    $monthlyTotals[$month] += 1

    if (-not $crimeTotals.ContainsKey($crimeType)) {
        $crimeTotals[$crimeType] = 0
    }
    $crimeTotals[$crimeType] += 1

    if (-not $districtTotals.ContainsKey($district)) {
        $districtTotals[$district] = 0
    }
    $districtTotals[$district] += 1

    if ($location -ne "") {
        if (-not $locationTotals.ContainsKey($location)) {
            $locationTotals[$location] = 0
        }
        $locationTotals[$location] += 1
    }

    $cubeKey = "$district|$crimeType|$month"
    if (-not $cube.ContainsKey($cubeKey)) {
        $cube[$cubeKey] = [ordered]@{
            district = $district
            crimeType = $crimeType
            month = $month
            allCount = 0
            arrestCount = 0
            domesticCount = 0
        }
    }

    $cube[$cubeKey].allCount += 1
    if ($isArrest) { $cube[$cubeKey].arrestCount += 1 }
    if ($isDomestic) { $cube[$cubeKey].domesticCount += 1 }

    if ($row.Latitude -ne "" -and $row.Longitude -ne "") {
        $overview.mappedRecords += 1
        if (-not $districtCentroids.ContainsKey($district)) {
            $districtCentroids[$district] = [ordered]@{
                district = $district
                latSum = 0.0
                lonSum = 0.0
                pointCount = 0
            }
        }
        $districtCentroids[$district].latSum += [double]$row.Latitude
        $districtCentroids[$district].lonSum += [double]$row.Longitude
        $districtCentroids[$district].pointCount += 1
    }
}

$centroids = $districtCentroids.Values | ForEach-Object {
    [ordered]@{
        district = $_.district
        latitude = [math]::Round($_.latSum / $_.pointCount, 6)
        longitude = [math]::Round($_.lonSum / $_.pointCount, 6)
        pointCount = $_.pointCount
    }
} | Sort-Object district

$topCrimeTypes = $crimeTotals.GetEnumerator() |
    Sort-Object Value -Descending |
    Select-Object -First 10 |
    ForEach-Object {
        [ordered]@{
            crimeType = $_.Key
            count = $_.Value
        }
    }

$topLocations = $locationTotals.GetEnumerator() |
    Sort-Object Value -Descending |
    Select-Object -First 6 |
    ForEach-Object {
        [ordered]@{
            location = $_.Key
            count = $_.Value
        }
    }

$monthlySeries = 1..12 | ForEach-Object {
    [ordered]@{
        month = $_
        count = if ($monthlyTotals.ContainsKey($_)) { $monthlyTotals[$_] } else { 0 }
    }
}

$districtSummary = $districtTotals.GetEnumerator() |
    Sort-Object Key |
    ForEach-Object {
        [ordered]@{
            district = $_.Key
            count = $_.Value
        }
    }

$meta = [ordered]@{
    source = "City of Chicago Crimes - 2025"
    generatedAt = (Get-Date).ToString("s")
    totalRecords = $overview.totalRecords
    mappedRecords = $overview.mappedRecords
    arrestRecords = $overview.arrestRecords
    domesticRecords = $overview.domesticRecords
    months = @(
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
    )
    topCrimeTypes = $topCrimeTypes
    topLocations = $topLocations
    districtSummary = $districtSummary
    centroids = $centroids
    monthlySeries = $monthlySeries
}

$cube.Values |
    Sort-Object district, crimeType, month |
    ConvertTo-Json -Depth 4 |
    Set-Content -Path (Join-Path $outputDir "crime-cube.json") -Encoding UTF8

$meta |
    ConvertTo-Json -Depth 6 |
    Set-Content -Path (Join-Path $outputDir "crime-meta.json") -Encoding UTF8
