-- Script para limpar mensagens com placeholders [keyId] e similares
-- Execute este script no banco de dados para remover mensagens inválidas

-- Ver quantas mensagens têm placeholders
SELECT COUNT(*) as total_placeholders
FROM whatsapp_messages 
WHERE content LIKE '[%]'
  AND content NOT LIKE '%http%'  -- Não apagar mensagens com links
  AND message_type = 'text';

-- DELETAR as mensagens com placeholders (CUIDADO: não tem ROLLBACK!)
-- Descomente a linha abaixo para executar
-- DELETE FROM whatsapp_messages 
-- WHERE content LIKE '[%]'
--   AND content NOT LIKE '%http%'
--   AND message_type = 'text';
