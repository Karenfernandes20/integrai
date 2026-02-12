# ✅ CRM Adicionado ao Menu da Loja

## Alteração

Adicionada a aba **CRM** ao menu de navegação para empresas com tipo de operação **"Loja"**.

## Arquivo Modificado

- `client/src/lib/MenuEngine.ts`

## O que foi feito

Adicionado o item de menu CRM após "Grupos" no `LOJA_MENU`:

```typescript
{ label: "CRM", icon: KanbanSquare, to: "/app/crm", requiredPermission: "crm.view" }
```

## Estrutura do Menu Loja (Atualizada)

1. ✅ Atendimento
2. ✅ Dashboard
3. ✅ Vendas
4. ✅ Clientes
5. ✅ Grupos
6. ✅ **CRM** ⭐ **(NOVO)**
7. ✅ Estoque
8. ✅ Financeiro
9. ✅ Fornecedores
10. ✅ Campanhas
11. ✅ Relatórios
12. ✅ Metas & Equipe
13. ✅ QR Code
14. ✅ Chatbot
15. ✅ Configurações

## Funcionalidades do CRM para Loja

Agora lojas podem utilizar o CRM para:

- 📊 **Funil de vendas** (Etapas customizadas)
- 👥 **Gestão de leads** (Novos clientes em potencial)
- 📈 **Conversão de vendas**
- 🎯 **Segmentação de clientes**
- 📝 **Histórico de negociações**
- 🔄 **Pipeline de vendas**

## Permissão Necessária

Para ver a aba CRM, o usuário precisa ter a permissão:
```
crm.view
```

## Como Testar

1. **Acesse** o sistema com uma conta do tipo operação "Loja"
2. **Verifique** o menu lateral
3. **Confirme** que a aba "CRM" está visível entre "Grupos" e "Estoque"
4. **Clique** em CRM para acessar o dashboard de vendas

---

✅ **Alteração aplicada com sucesso!**
