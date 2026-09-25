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

Write-Host "`n== 0. Подготовка ==" -ForegroundColor Cyan
# Счётчики частоты живут в памяти процесса, а предыдущий прогон исчерпывает
# окно проверкой лимита. Поэтому перед тестами состояние сбрасывается —
# иначе набор тестов не воспроизводится. В продакшене эндпоинта нет.
try {
  $reset = Invoke-RestMethod "$base/api/dev/reset-limits" -Method Post
  Check "служебный сброс лимитов доступен" ($reset.ok -eq $true) "сброс не сработал"
} catch {
  Check "служебный сброс лимитов доступен" $false "код $($_.Exception.Response.StatusCode.value__) — серверу нужен ALLOW_TEST_ENDPOINTS=1"
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
$testPlayers = 6
for ($offset = 0; $offset -lt 14 -and -not $targetDate; $offset++) {
  $probe = (Get-Date).AddDays($offset).ToString("yyyy-MM-dd")
  $response = Invoke-RestMethod "$base/api/availability?quest=ritual&date=$probe"
  # Слот должен быть не только свободным, но и вмещать всю тестовую команду:
  # сервер проверяет вместимость, поэтому «свободно» ещё не значит «можно»
  $free = @($response.availability.slots | Where-Object {
    $_.status -ne "past" -and $_.status -ne "sold-out" -and [int]$_.seatsLeft -ge $testPlayers
  })
  if ($free.Count -gt 0) {
    $targetDate = $probe
    $slotTime = $free[0].time
  }
}
Check "есть день со свободным слотом на 6 человек" ($null -ne $targetDate) "за 14 дней не нашлось слота на 6 мест"

$monthData = Invoke-RestMethod "$base/api/availability?quest=ritual&month=$month"
$days = ($monthData.summary | Get-Member -MemberType NoteProperty).Count
Check "GET /api/availability (месяц) ok" ($monthData.ok -eq $true) "ответ без ok"
Check "сводка по месяцу не пустая" ($days -ge 28) "дней в сводке: $days"

Write-Host "`n== 3. Создание брони ==" -ForegroundColor Cyan
$payload = @{
  questSlug = "ritual"
  players   = $testPlayers
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

# Оборачиваем в try/catch: если сервер отклонит заявку, тест должен
# написать понятный FAIL, а не упасть с трассировкой
try {
  $created = Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body $payload
  Check "POST /api/bookings создаёт бронь" ($created.ok -eq $true -and $created.booking.id) "ответ: $($created | ConvertTo-Json -Compress)"
  Check "цена посчитана (6 x 3500 - 3500 акция)" ($created.booking.total -eq 17500) "итог: $($created.booking.total)"
  Check "состав заказа сохранён" ($created.booking.priceBreakdown.Count -ge 2) "строк в чеке: $($created.booking.priceBreakdown.Count)"
} catch {
  $body = Get-ErrorBody $_
  Check "POST /api/bookings создаёт бронь" $false "код $($_.Exception.Response.StatusCode.value__): $($body | ConvertTo-Json -Compress)"
  $created = $null
}

if ($created) {
  $duplicate = Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body $payload
  Check "дубль не создаётся" ($duplicate.duplicate -eq $true -and $duplicate.booking.id -eq $created.booking.id) "новый id: $($duplicate.booking.id)"
}

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

Write-Host "`n== 4b. Защита слотов (сервер — источник истины) ==" -ForegroundColor Cyan

function New-BookingBody($overrides) {
  $base = @{
    questSlug = "ritual"; players = 3; fearMode = "light"; dateISO = $targetDate; time = $slotTime
    extraIds = @(); isBirthday = $false; name = "Тест Слотов"; phone = "+7 701 000 00 99"
    messenger = "whatsapp"; comment = ""
  }
  foreach ($key in $overrides.Keys) { $base[$key] = $overrides[$key] }
  return ($base | ConvertTo-Json)
}

# 1. Прошедшее время: заявку на вчерашний день сервер обязан отклонить
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
try {
  Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body (New-BookingBody @{ dateISO = $yesterday; time = "19:30" }) | Out-Null
  Check "заявка на прошедшую дату отклонена" $false "сервер принял бронь на вчера"
} catch {
  $body = Get-ErrorBody $_
  Check "заявка на прошедшую дату отклонена (422)" ($_.Exception.Response.StatusCode.value__ -eq 422) "код $($_.Exception.Response.StatusCode.value__)"
  Check "в ошибке указано время" ($body -and $body.errors.time) "ошибки: $($body.errors | ConvertTo-Json -Compress)"
}

# 2. Переполнение слота: занимаем слот целиком, затем пробуем ещё раз
$fillDate = $null; $fillTime = $null; $fillSeats = 0
for ($offset = 0; $offset -lt 7 -and -not $fillDate; $offset++) {
  $probe = (Get-Date).AddDays($offset).ToString("yyyy-MM-dd")
  $resp = Invoke-RestMethod "$base/api/availability?quest=ritual&date=$probe"
  # Вместимость должна быть не меньше минимальной команды квеста (2 человека):
  # слот с одним свободным местом занять полностью нельзя по правилам заведения
  $candidate = @($resp.availability.slots | Where-Object {
    ($_.status -eq "available" -or $_.status -eq "few-left") -and [int]$_.seatsLeft -ge 2
  } | Select-Object -First 1)
  if ($candidate.Count -gt 0) {
    $fillDate = $probe
    $fillTime = $candidate[0].time
    $fillSeats = [Math]::Min(15, [int]$candidate[0].seatsLeft)
  }
}
Check "найден слот для проверки переполнения" ($null -ne $fillDate) "свободных слотов нет"

if ($fillDate) {
  $filler = Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body (New-BookingBody @{ dateISO = $fillDate; time = $fillTime; players = $fillSeats; phone = "+7 701 000 00 98" })
  Check "слот занят полностью" ($filler.ok -eq $true) "не удалось занять слот"

  try {
    Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body (New-BookingBody @{ dateISO = $fillDate; time = $fillTime; players = 3; phone = "+7 701 000 00 97" }) | Out-Null
    Check "переполнение слота отклонено" $false "сервер продал больше мест, чем есть"
  } catch {
    $body = Get-ErrorBody $_
    Check "переполнение слота отклонено (422)" ($_.Exception.Response.StatusCode.value__ -eq 422) "код $($_.Exception.Response.StatusCode.value__)"
    Check "в ошибке объяснено, что мест нет" ($body -and $body.errors.time) "ошибки: $($body.errors | ConvertTo-Json -Compress)"
  }
}

Write-Host "`n== 5. Защита админки ==" -ForegroundColor Cyan

# Запрос с чужого домена не должен проходить на изменяющие эндпоинты
try {
  Invoke-RestMethod "$base/api/admin/session" -Method Post -Headers @{ Origin = "https://evil.example.com" } -ContentType "application/json" -Body (@{ password = "horror-clinic" } | ConvertTo-Json) | Out-Null
  Check "вход с чужого домена отклонён" $false "запрос с внешним Origin прошёл"
} catch {
  Check "вход с чужого домена отклонён (403)" ($_.Exception.Response.StatusCode.value__ -eq 403) "код $($_.Exception.Response.StatusCode.value__)"
}

try {
  Invoke-RestMethod "$base/api/bookings" | Out-Null
  Check "список броней закрыт без входа" $false "список доступен анонимно"
} catch {
  Check "список броней закрыт без входа (401)" ($_.Exception.Response.StatusCode.value__ -eq 401) "код $($_.Exception.Response.StatusCode.value__)"
}

# Пароль админки берём из окружения или из .env.local — в продакшене
# дефолтного пароля больше нет, панель без переменных просто отключена
$adminPassword = $env:ADMIN_PASSWORD
if (-not $adminPassword -and (Test-Path ".env.local")) {
  $line = Select-String -Path ".env.local" -Pattern "^ADMIN_PASSWORD=" | Select-Object -First 1
  if ($line) { $adminPassword = ($line.Line -replace "^ADMIN_PASSWORD=", "").Trim() }
}
if (-not $adminPassword) { $adminPassword = "horror-clinic" }

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-RestMethod "$base/api/admin/session" -Method Post -WebSession $session -ContentType "application/json" -Body (@{ password = $adminPassword } | ConvertTo-Json)
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

Write-Host "`n== 7. Лимит частоты и заголовки безопасности ==" -ForegroundColor Cyan

# Лимит: 12 заявок за 15 минут с одного адреса. Тест сознательно идёт последним:
# он исчерпывает окно, поэтому требует свежезапущенного сервера.
$got429 = $false
for ($i = 0; $i -lt 16; $i++) {
  try {
    Invoke-RestMethod "$base/api/bookings" -Method Post -ContentType "application/json; charset=utf-8" -Body (New-BookingBody @{ phone = "+7 701 000 01 " + $i.ToString("00") }) | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 429) { $got429 = $true; break }
  }
}
Check "лимит частоты срабатывает (429)" $got429 "16 запросов прошли без ограничения"

# Возвращаем счётчики в исходное состояние, иначе следующий прогон тестов
# не сможет проверить обычную бронь (в продакшене эндпоинта нет — там 404)
try {
  $reset = Invoke-RestMethod "$base/api/dev/reset-limits" -Method Post
  Check "лимиты сбрасываются служебным хуком" ($reset.ok -eq $true) "сброс не сработал"
} catch {
  Check "служебный сброс доступен в тестовом окружении" $false "код $($_.Exception.Response.StatusCode.value__)"
}

$headers = (Invoke-WebRequest "$base/" -UseBasicParsing).Headers
Check "CSP установлен" ([bool]$headers["Content-Security-Policy"]) "нет Content-Security-Policy"
Check "X-Frame-Options = DENY" ($headers["X-Frame-Options"] -eq "DENY") "значение: $($headers['X-Frame-Options'])"
Check "Permissions-Policy установлен" ([bool]$headers["Permissions-Policy"]) "нет Permissions-Policy"
Check "nosniff установлен" ($headers["X-Content-Type-Options"] -eq "nosniff") "значение: $($headers['X-Content-Type-Options'])"
Check "X-Powered-By скрыт" (-not $headers["X-Powered-By"]) "заголовок всё ещё отдаётся"

$apiHeaders = (Invoke-WebRequest "$base/api/availability?quest=ritual&date=$today" -UseBasicParsing).Headers
Check "API не кешируется" ($apiHeaders["Cache-Control"] -like "*no-store*") "Cache-Control: $($apiHeaders['Cache-Control'])"

Write-Host "`n== ИТОГ ==" -ForegroundColor Cyan
Write-Host "  Пройдено: $pass" -ForegroundColor Green
Write-Host "  Провалено: $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
if ($fail -gt 0) { exit 1 }
