$path = "src/frontend/pdf-home/features/sidebar/saved-filters/index.js"
$c = Get-Content -Path $path -Raw -Encoding UTF8
$c = $c -replace "type:\s*WEBSOCKET_MESSAGE_TYPES.GET_CONFIG,\s*\r?\n\s*request_id:\s*rid","type: WEBSOCKET_MESSAGE_TYPES.GET_CONFIG,`n        request_id: rid,`n        metadata: { version: '1.0.0' }"
$c = $c -replace "type:\s*WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG,\s*\r?\n\s*request_id:\s*rid,\s*\r?\n\s*data:","type: WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG,`n          request_id: rid,`n          metadata: { version: '1.0.0' },`n          data:"
Set-Content -Path $path -Value $c -Encoding utf8
