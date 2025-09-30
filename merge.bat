@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    Easy Notes - Merge Tool
echo ==========================================
echo.
echo Trascina due file .ezn qui per unirli
echo.

REM Verifica che siano stati passati esattamente 2 file
if "%~2"=="" (
    echo ERRORE: Devi trascinare esattamente 2 file .ezn
    echo.
    echo Uso: Trascina due file .ezn su questo file .bat
    pause
    exit /b 1
)

if not "%~3"=="" (
    echo ERRORE: Troppi file! Devi trascinare esattamente 2 file .ezn
    echo.
    echo Uso: Trascina due file .ezn su questo file .bat
    pause
    exit /b 1
)

set "file1=%~1"
set "file2=%~2"

REM Verifica che i file esistano
if not exist "%file1%" (
    echo ERRORE: Il file "%file1%" non esiste
    pause
    exit /b 1
)

if not exist "%file2%" (
    echo ERRORE: Il file "%file2%" non esiste
    pause
    exit /b 1
)

REM Verifica che i file abbiano estensione .ezn
if /i not "%~x1"==".ezn" (
    echo ERRORE: Il primo file non ha estensione .ezn
    pause
    exit /b 1
)

if /i not "%~x2"==".ezn" (
    echo ERRORE: Il secondo file non ha estensione .ezn
    pause
    exit /b 1
)

echo File 1: %file1%
echo File 2: %file2%
echo.

REM Crea il nome del file di output basato sul primo file
set "outputfile=%~dpn1_merged.ezn"

echo Creazione file unito: !outputfile!
echo.

REM Crea lo script PowerShell temporaneo per il merge
set "tempscript=%temp%\merge_ezn_%random%.ps1"

echo # Script PowerShell per merge file .ezn > "%tempscript%"
echo try { >> "%tempscript%"
echo     # Leggi i due file JSON >> "%tempscript%"
echo     $file1Content = Get-Content -Path $args[0] -Raw ^| ConvertFrom-Json >> "%tempscript%"
echo     $file2Content = Get-Content -Path $args[1] -Raw ^| ConvertFrom-Json >> "%tempscript%"
echo. >> "%tempscript%"
echo     # Inizializza il risultato >> "%tempscript%"
echo     $mergedNotes = @{} >> "%tempscript%"
echo     $totalPages1 = if ($file1Content.totalPages^) { $file1Content.totalPages } else { 0 } >> "%tempscript%"
echo     $totalPages2 = if ($file2Content.totalPages^) { $file2Content.totalPages } else { 0 } >> "%tempscript%"
echo     $lastPage1 = if ($file1Content.lastPage^) { $file1Content.lastPage } else { 1 } >> "%tempscript%"
echo     $lastPage2 = if ($file2Content.lastPage^) { $file2Content.lastPage } else { 1 } >> "%tempscript%"
echo. >> "%tempscript%"
echo     # Copia le note del primo file >> "%tempscript%"
echo     if ($file1Content.notes^) { >> "%tempscript%"
echo         foreach ($page in $file1Content.notes.PSObject.Properties^) { >> "%tempscript%"
echo             $mergedNotes[$page.Name] = $page.Value >> "%tempscript%"
echo         } >> "%tempscript%"
echo     } >> "%tempscript%"
echo. >> "%tempscript%"
echo     # Unisci le note del secondo file >> "%tempscript%"
echo     if ($file2Content.notes^) { >> "%tempscript%"
echo         foreach ($page in $file2Content.notes.PSObject.Properties^) { >> "%tempscript%"
echo             $pageNum = $page.Name >> "%tempscript%"
echo             $newNote = $page.Value >> "%tempscript%"
echo. >> "%tempscript%"
echo             if ($mergedNotes.ContainsKey($pageNum^)^) { >> "%tempscript%"
echo                 # Se la pagina esiste già, aggiungi le note sotto >> "%tempscript%"
echo                 $existingNote = $mergedNotes[$pageNum].ToString(^).Trim(^) >> "%tempscript%"
echo                 $newNoteText = $newNote.ToString(^).Trim(^) >> "%tempscript%"
echo. >> "%tempscript%"
echo                 if ($existingNote -and $newNoteText^) { >> "%tempscript%"
echo                     $mergedNotes[$pageNum] = $existingNote + "`n`n---`n`n" + $newNoteText >> "%tempscript%"
echo                 } elseif ($newNoteText^) { >> "%tempscript%"
echo                     $mergedNotes[$pageNum] = $newNoteText >> "%tempscript%"
echo                 } >> "%tempscript%"
echo             } else { >> "%tempscript%"
echo                 # Se la pagina non esiste, aggiungila >> "%tempscript%"
echo                 $mergedNotes[$pageNum] = $newNote >> "%tempscript%"
echo             } >> "%tempscript%"
echo         } >> "%tempscript%"
echo     } >> "%tempscript%"
echo. >> "%tempscript%"
echo     # Determina la data più recente >> "%tempscript%"
echo     $date1 = if ($file1Content.savedAt^) { [DateTime]::Parse($file1Content.savedAt^) } else { [DateTime]::MinValue } >> "%tempscript%"
echo     $date2 = if ($file2Content.savedAt^) { [DateTime]::Parse($file2Content.savedAt^) } else { [DateTime]::MinValue } >> "%tempscript%"
echo     $maxDate = if ($date1 -gt $date2^) { $date1 } else { $date2 } >> "%tempscript%"
echo. >> "%tempscript%"
echo     # Ordina le note per numero di pagina >> "%tempscript%"
echo     $orderedNotes = [ordered]@{} >> "%tempscript%"
echo     $sortedKeys = $mergedNotes.Keys ^| Sort-Object { [int]$_ } >> "%tempscript%"
echo     foreach ($key in $sortedKeys^) { >> "%tempscript%"
echo         $orderedNotes[$key] = $mergedNotes[$key] >> "%tempscript%"
echo     } >> "%tempscript%"
echo. >> "%tempscript%"
echo     # Crea il risultato finale >> "%tempscript%"
echo     $result = [ordered]@{ >> "%tempscript%"
echo         notes = $orderedNotes >> "%tempscript%"
echo         totalPages = [Math]::Max($totalPages1, $totalPages2^) >> "%tempscript%"
echo         lastPage = [Math]::Max($lastPage1, $lastPage2^) >> "%tempscript%"
echo         savedAt = $maxDate.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"^) >> "%tempscript%"
echo     } >> "%tempscript%"
echo. >> "%tempscript%"
echo     # Salva il file unito >> "%tempscript%"
echo     $result ^| ConvertTo-Json -Depth 10 ^| Set-Content -Path $args[2] -Encoding UTF8 >> "%tempscript%"
echo. >> "%tempscript%"
echo     Write-Host "Merge completato con successo!" -ForegroundColor Green >> "%tempscript%"
echo     Write-Host "File salvato come:" $args[2] -ForegroundColor Yellow >> "%tempscript%"
echo     Write-Host "" >> "%tempscript%"
echo     Write-Host "Statistiche merge:" -ForegroundColor Cyan >> "%tempscript%"
echo     Write-Host "- Pagine totali:" $result.totalPages -ForegroundColor White >> "%tempscript%"
echo     Write-Host "- Ultima pagina:" $result.lastPage -ForegroundColor White >> "%tempscript%"
echo     Write-Host "- Note totali:" $mergedNotes.Count -ForegroundColor White >> "%tempscript%"
echo     Write-Host "- Data salvataggio:" $result.savedAt -ForegroundColor White >> "%tempscript%"
echo. >> "%tempscript%"
echo } catch { >> "%tempscript%"
echo     Write-Host "ERRORE durante il merge:" $_.Exception.Message -ForegroundColor Red >> "%tempscript%"
echo     exit 1 >> "%tempscript%"
echo } >> "%tempscript%"

REM Esegui il merge con PowerShell
echo Esecuzione del merge...
powershell -ExecutionPolicy Bypass -File "%tempscript%" "%file1%" "%file2%" "!outputfile!"

if !errorlevel! neq 0 (
    echo.
    echo ERRORE: Il merge e' fallito. Verifica che:
    echo - I file .ezn siano validi formato JSON
    echo - I file non siano corrotti
    goto cleanup
)

echo.
echo ==========================================
echo Merge completato con successo!
echo ==========================================
echo.
echo Il file unito e' stato salvato come:
echo !outputfile!
echo.

:cleanup
REM Pulisci il file temporaneo
if exist "%tempscript%" del "%tempscript%"

echo Premi un tasto per chiudere...
pause >nul
