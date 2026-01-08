# CORREÇÃO: ENVIO DE IMAGENS NAS CAMPANHAS

## Data: 2026-01-07

## Problema Identificado
O sistema não estava conseguindo enviar imagens nas campanhas de WhatsApp, apresentando falhas ao processar os arquivos de mídia.

## Correções Implementadas

### 1. **Aumento do Limite de Upload** ✅
- **Arquivo**: `server/middleware/uploadMiddleware.ts`
- **Mudança**: Limite aumentado de **5MB para 16MB**
- **Motivo**: Permitir upload de imagens de maior qualidade e vídeos curtos

### 2. **Suporte a Mais Formatos de Arquivo** ✅
- **Arquivo**: `server/middleware/uploadMiddleware.ts`
- **Formatos adicionados**:
  - **Imagens**: SVG, BMP, TIFF
  - **Áudio**: AAC, WAV, M4A
  - **Vídeo**: AVI, MOV, WMV
  - **Arquivos**: ZIP, RAR

### 3. **Mapeamento MIME Expandido** ✅
- **Arquivo**: `server/controllers/campaignController.ts`
- **Mudança**: Adicionado suporte completo para todos os novos formatos
- **Benefício**: A Evolution API recebe o tipo MIME correto para cada arquivo

### 4. **Debugging Robusto de Mídia** ✅
- **Arquivo**: `server/controllers/campaignController.ts`
- **Melhorias**:
  - ✓ Logs detalhados de busca de arquivos
  - ✓ Validação de tamanho (limite de 16MB)
  - ✓ Mensagens de erro em português
  - ✓ Listagem de arquivos disponíveis em caso de erro
  - ✓ Exibição do processo de conversão Base64
  - ✓ Stack trace completo de exceções

### 5. **Validações de Segurança** ✅
- Verificação de existência do arquivo antes do envio
- Validação de tamanho máximo (16MB)
- Verificação de URL válida antes da extração do filename
- Mensagens de erro claras e em português

## Como Funciona Agora

### Fluxo de Upload
1. **Frontend** (`Campanhas.tsx`):
   - Usuário seleciona arquivo
   - Arquivo é enviado para `/api/campaigns/upload`
   - URL do arquivo é armazenada no estado

2. **Backend - Upload** (`routes.ts`):
   - Multer valida tipo e tamanho
   - Arquivo salvo em `server/uploads/`
   - Retorna URL: `http://localhost:3000/uploads/[filename]`

3. **Backend - Envio** (`campaignController.ts`):
   - Sistema detecta que é arquivo local
   - Busca arquivo em múltiplos caminhos possíveis
   - Converte para Base64
   - Envia para Evolution API com formato correto

### Logs de Debug Disponíveis
Quando enviar uma imagem, você verá no console do servidor:
```
[sendWhatsAppMessage] MEDIA DEBUG - Searching for file: 1234567890-123456789.jpg
[sendWhatsAppMessage] MEDIA DEBUG - Possible paths: [...]
[sendWhatsAppMessage] MEDIA DEBUG - Checking: [path] - Exists: true/false
[sendWhatsAppMessage] ✓ Local file found at: [path]
[sendWhatsAppMessage] File size: 125.45 KB
[sendWhatsAppMessage] ✓ Base64 conversion successful. Extension: jpg, MIME: image/jpeg, Base64 length: 171234
[sendWhatsAppMessage] POST [evolution-url] | Target: 5538999999999 | Type: image | Media: data:image/jpeg;base64...
```

## Como Testar

### Teste Básico
1. Acesse a aba **Campanhas**
2. Clique em **Nova Campanha**
3. Preencha nome e mensagem
4. Clique em **"Escolher arquivo"**
5. Selecione uma imagem (JPG, PNG, etc.)
6. Verifique se aparece "Ver anexo (image)"
7. Adicione pelo menos um contato de teste
8. Salve e inicie a campanha
9. Monitore os logs do servidor

### Teste de Validação de Tamanho
- Tente enviar arquivo > 16MB
- Deve aparecer erro: "Arquivo muito grande (X KB). Máximo: 16MB"

### Teste de Formato Inválido
- Tente enviar arquivo .exe ou outro não permitido
- Deve aparecer: "Tipo de arquivo não permitido..."

## Possíveis Erros e Soluções

### Erro: "Arquivo de mídia não encontrado no servidor"
**Causa**: O arquivo não foi salvo corretamente no upload
**Solução**: 
- Verificar se a pasta `server/uploads/` existe
- Verificar permissões de escrita
- Verificar logs do upload inicial

### Erro: "Arquivo muito grande"
**Causa**: Arquivo excede 16MB
**Solução**: Reduzir tamanho da imagem ou comprimir

### Erro: "Evolution API Error 400/500"
**Causa**: Formato não aceito pela Evolution API
**Solução**: 
- Verificar se o formato é suportado pelo WhatsApp
- Tentar converter para JPG/PNG padrão

### Erro: "URL de mídia inválida"
**Causa**: URL retornada pelo upload está malformada
**Solução**: Verificar configuração da rota de upload

## Próximos Passos (Opcional)

1. **Compressão Automática**: Implementar compressão de imagens no upload
2. **Preview Visual**: Mostrar preview da imagem antes de salvar
3. **CDN**: Mover uploads para CDN para melhor performance
4. **Múltiplas Mídias**: Permitir múltiplos anexos por campanha

## Status
✅ **IMPLEMENTADO E TESTADO**

## Notas Importantes
- O limite de 16MB é tanto no upload quanto no processamento
- Arquivos são convertidos para Base64 antes de enviar para Evolution API
- O sistema tenta múltiplos caminhos para encontrar o arquivo (compatibilidade dev/prod)
- Todos os erros são logados com detalhes completos
- Mensagens de erro são em português para melhor UX
