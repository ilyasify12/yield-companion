param($StopFile)

Add-Type -AssemblyName System.Speech

$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$choices = New-Object System.Speech.Recognition.Choices
$choices.Add("Mia")
$choices.Add("James")
$choices.Add("mia")
$choices.Add("james")

$grammarBuilder = New-Object System.Speech.Recognition.GrammarBuilder
$grammarBuilder.Append($choices)
$grammar = New-Object System.Speech.Recognition.Grammar($grammarBuilder)

$recognizer.LoadGrammar($grammar)

# Register the speech recognized event
Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognized -Action {
  $word = $event.SourceEventArgs.Result.Text
  Write-Host "WAKEWORD:$word"
} | Out-Null

# Start listening
$recognizer.SetInputToDefaultAudioDevice()
$recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

Write-Host "WAKEWORD:READY"

# Wait until stop file is deleted or 30s timeout, then poll
while (Test-Path $StopFile) {
  Start-Sleep -Milliseconds 500
}

$recognizer.Dispose()
Write-Host "WAKEWORD:STOPPED"