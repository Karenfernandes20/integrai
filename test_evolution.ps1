
# Script de Teste Manual CURL para Evolution API
# Execute isso no terminal para validar a conexão direta

$INSTANCE = "KAREN_OFC" # Substitua pelo nome da sua instância
$APIKEY = "429683C4C977415CAAFCCE10F7D57E11" # Substitua pela sua API KEY
$PHONE = "5538997501066" # Substitua pelo seu numero
$BASE_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host"

# 1. Teste de Texto Simples
Write-Host "1. Testando envio de Texto..."
curl.exe -v -X POST "$BASE_URL/message/sendText/$INSTANCE" `
  -H "apikey: $APIKEY" `
  -H "Content-Type: application/json" `
  -d "{\"number\": \"$PHONE\", \"options\": {\"delay\": 1200, \"presence\": \"composing\"}, \"textMessage\": {\"text\": \"Teste CURL Texto\"}}"

# 2. Teste de Imagem (URL)
Write-Host "`n2. Testando envio de Imagem (URL)..."
curl.exe -v -X POST "$BASE_URL/message/sendMedia/$INSTANCE" `
    -H "apikey: $APIKEY" `
    -H "Content-Type: application/json" `
    -d "{\"number\": \"$PHONE\", \"options\": {\"delay\": 1200, \"presence\": \"composing\"}, \"mediaMessage\": {\"mediatype\": \"image\", \"caption\": \"Teste CURL Imagem URL\", \"media\": \"https://via.placeholder.com/150\"}}"

# 3. Teste de Imagem (Multipart - CORRETO)
# Crie um arquivo 'teste.jpg' na mesma pasta antes de rodar
Write-Host "`n3. Testando envio de Imagem (Multipart) - OBRIGATÓRIO ter teste.jpg..."
# Nota: O comando curl multipart no Windows powershell pode ser chato, use cmd.exe se falhar
# curl.exe -v -X POST "$BASE_URL/message/sendMedia/$INSTANCE" -H "apikey: $APIKEY" -F "number=$PHONE" -F "mediatype=image" -F "media=@teste.jpg" -F "caption=Teste CURL Multipart"
