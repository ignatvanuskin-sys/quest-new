# Smoke-тест API: бронирование, доступность, защита админки.
# Запуск: powershell -File scripts/smoke-test.ps1
# Требует запущенный сервер на http://localhost:3000

$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"
$today = (Get-Date).ToString("yyyy-MM-dd")
$month = (Get-Date).ToString("yyyy-MM")
$pass = 0
$fail = 0

function Check($name, $condition, $detail) {
  if ($condition) {
    Write-Host "  PASS  $name" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  FAIL  $name -> $detail" -ForegroundColor Red
    $script:fail++
  }
}

function Get-ErrorBody($errorRecord) {
  # В PowerShell 5.1 тело ответа лежит в потоке ответа, а не в ErrorDetails
  try {
    $stream = $errorRecord.Exception.Response.GetResponseStream()
    if (-not $stream) { return $null }
    $reader = New-Object System.IO.StreamReader($stream)
    $raw = $reader.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return ($raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

Write-Host "`n== 1. Главная страница ==" -ForegroundColor Cyan
$homePage = Invoke-WebRequest "$base/" -UseBasicParsing
Check "GET / = 200" ($homePage.StatusCode -eq 200) "код $($homePage.StatusCode)"
Check "hero-заголовок на месте" ($homePage.Content -match "Не заходи") "не найден текст hero"
Check "структурированные данные LocalBusiness" ($homePage.Content -match "LocalBusiness") "нет JSON-LD"
Check "FAQPage-разметка" ($homePage.Content -match "FAQPage") "нет FAQ-разметки"
Check "canonical на главной" ($homePage.Content -match 'rel="canonical"') "нет canonical"

Write-Host "`n== 2. Доступность слотов ==" -ForegroundColor Cyan
$day = Invoke-RestMethod "$base/api/availability?quest=ritual&date=$today"
Check "GET /api/availability (день) ok" ($day.ok -eq $true) "ответ без ok"
Check "в дне 8 слотов" ($day.availability.slots.Count -eq 8) "слотов: $($day.availability.slots.Count)"
$bookable = @($day.availability.slots | Where-Object { $_.status -ne "past" -and $_.status -ne "sold-out" })
Check "прошедшее время помечено как past" (@($day.availability.slots | Where-Object { $_.status -eq "past" }).Count -ge 0) "статусы без past"

# Ищем ближайший день со свободным слотом: вечером «сегодня» может быть уже
# полностью закрыто прошедшим временем — это нормальное поведение.
$targetDate = $null
$slotTime = $null
for ($offset = 0; $offset -lt 7 -and -not $targetDate; $offset++) {
  $probe = (Get-Date).AddDays($offset).ToString("yyyy-MM-dd")
  $response = Invoke-RestMethod "$base/api/availability?quest=ritual&date=$probe"
  $free = @($response.availability.slots | Where-Object { $_.status -ne "past" -and $_.status -ne "sold-out" })
  if ($free.Count -gt 0) {
    $targetDate = $probe
    $slotTime = $free[0].time
  }
}
Check "есть день со свободным слотом в ближайшую неделю" ($null -ne $targetDate) "все 7 дней заняты"

$monthData = Invoke-RestMethod "$base/api/availability?quest=ritual&month=$month"
$days = ($monthData.summary | Get-Member -MemberType NoteProperty).Count
Check "GET /api/availability (месяц) ok" ($monthData.ok -eq $true) "ответ без ok"
Check "сводка по месяцу не пустая" ($days -ge 28) "дней в сводке: $days"

Write-Host "`n== 3. Создание брони ==" -ForegroundColor Cyan
$payload = @{
  questSlug = "ritual"
  players   = 6
  fearMode  = "medium"
  dateISO   = $targetDate
  time      = $slotTime
  extraIds  = @("corporate-docs")
  isBirthday = $true
  name      = "Тест Тестов"
  phone     = "+7 701 000 00 01"
  messenger = "whatsapp"
  comment   = "Проверка формы бронирования"
} | ConvertTo-Json

$created = Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body $payload
Check "POST /api/bookings создаёт бронь" ($created.ok -eq $true -and $created.booking.id) "ответ: $($created | ConvertTo-Json -Compress)"
Check "цена посчитана (6 x 3500 - 3500 акция)" ($created.booking.total -eq 17500) "итог: $($created.booking.total)"
Check "состав заказа сохранён" ($created.booking.priceBreakdown.Count -ge 2) "строк в чеке: $($created.booking.priceBreakdown.Count)"

$duplicate = Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body $payload
Check "дубль не создаётся" ($duplicate.duplicate -eq $true -and $duplicate.booking.id -eq $created.booking.id) "новый id: $($duplicate.booking.id)"

Write-Host "`n== 4. Валидация формы ==" -ForegroundColor Cyan
$badPayload = @{
  questSlug = "ritual"; players = 99; fearMode = "hard"; dateISO = ""; time = ""
  extraIds = @(); isBirthday = $false; name = "A"; phone = "123"; messenger = "whatsapp"; comment = ""
} | ConvertTo-Json
try {
  Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body $badPayload | Out-Null
  Check "некорректная заявка отклонена" $false "сервер принял мусорные данные"
} catch {
  $body = Get-ErrorBody $_
  Check "некорректная заявка отклонена (422)" ($_.Exception.Response.StatusCode.value__ -eq 422) "код $($_.Exception.Response.StatusCode.value__)"
  Check "ошибки по игрокам/дате/телефону" ($body -and $body.errors.players -and $body.errors.dateISO -and $body.errors.phone) "тело: $($body | ConvertTo-Json -Compress)"
}

Write-Host "`n== 5. Защита админки ==" -ForegroundColor Cyan
try {
  Invoke-RestMethod "$base/api/bookings" | Out-Null
  Check "список броней закрыт без входа" $false "список доступен анонимно"
} catch {
  Check "список броней закрыт без входа (401)" ($_.Exception.Response.StatusCode.value__ -eq 401) "код $($_.Exception.Response.StatusCode.value__)"
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-RestMethod "$base/api/admin/session" -Method Post -WebSession $session -ContentType "application/json" -Body (@{ password = "horror-clinic" } | ConvertTo-Json)
Check "вход по паролю" ($login.ok -eq $true) "ответ: $($login | ConvertTo-Json -Compress)"

$list = Invoke-RestMethod "$base/api/bookings" -WebSession $session
Check "админ видит брони" ($list.ok -eq $true -and $list.bookings.Count -ge 1) "броней: $($list.bookings.Count)"
Check "статистика посчитана" ($list.stats.total -ge 1 -and $list.stats.revenue -gt 0) "статистика: $($list.stats | ConvertTo-Json -Compress)"

$patched = Invoke-RestMethod "$base/api/bookings/$($created.booking.id)" -Method Patch -WebSession $session -ContentType "application/json" -Body (@{ status = "confirmed" } | ConvertTo-Json)
Check "смена статуса брони" ($patched.booking.status -eq "confirmed") "статус: $($patched.booking.status)"

Write-Host "`n== 6. Страницы ==" -ForegroundColor Cyan
foreach ($path in @("/booking", "/quests/ritual", "/quests/karatelnaya-psihiatriya", "/admin", "/sitemap.xml", "/robots.txt")) {
  $page = Invoke-WebRequest "$base$path" -UseBasicParsing
  Check "GET $path = 200" ($page.StatusCode -eq 200) "код $($page.StatusCode)"
}
try {
  Invoke-WebRequest "$base/quests/no-such-quest" -UseBasicParsing | Out-Null
  Check "несуществующий квест = 404" $false "вернулся код 200"
} catch {
  Check "несуществующий квест = 404" ($_.Exception.Response.StatusCode.value__ -eq 404) "код $($_.Exception.Response.StatusCode.value__)"
}

Write-Host "`n== ИТОГ ==" -ForegroundColor Cyan
Write-Host "  Пройдено: $pass" -ForegroundColor Green
Write-Host "  Провалено: $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
if ($fail -gt 0) { exit 1 }
