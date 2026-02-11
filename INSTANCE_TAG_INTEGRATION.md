# 📋 Instrução de Integração: InstanceTag

## ✅ Componente Criado: `InstanceTag.tsx`

O componente `InstanceTag` foi criado para exibir o nome comercial da instância WhatsApp nos cards de conversa.

---

## 🔧 Como Usar

### **1. Importar no Atendimento.tsx (linha ~92)**

Adicione ao topo do arquivo junto com os outros imports:

```typescript
import { InstanceTag } from "../components/InstanceTag";
```

### **2. Adicionar nos Cards de Conversa**

Procure por onde renderiza os cards de conversa (provavelmente próximo da linha 2500-2800).

**Exemplo de uso:**

```jsx
<div className="card-conversation">
  <div className="flex items-center">
    <Avatar>...</Avatar>
    <div className="flex-1">
      <h4>{conversation.contact_name}</h4>
      <p>{conversation.last_message}</p>
    </div>
    
    {/* 👇 ADICIONAR AQUI */}
    <InstanceTag 
      instanceName={conversation.instance_friendly_name} 
      variant="compact"
    />
  </div>
</div>
```

### **3. Variantes Disponíveis**

- `variant="default"` - Tag normal (padrão)
- `variant="compact"` - Tag compacta (recomendado para cards pequenos)

---

## 📍 Onde Adicionar

### **Locations sugeridas:**

1. **Cards de Conversas (Tabs: PENDING, OPEN, CLOSED)**
   - Posição: Canto inferior direito de cada card
   
2. **Lista de Mensagens na Conversa Aberta**
   - Posição: Abaixo do nome do remetente em cada mensagem

3. **Cards de Grupos**
   - Posição: Igual aos cards de conversas individuais

---

## 🎨 Aparência Final

```
┌──────────────────────────────────┐
│ 👤 João Silva                   │
│ 💬 Olá, tudo bem?              │
│ 🕐 14:30         📱 [Comercial]│ ← Tag aqui
└──────────────────────────────────┘
```

---

## ⚡ Teste Rápido

Depois de adicionar nos 3 locais descritos acima, recarregue a página.
As tags devem aparecer automaticamente em todas as conversas/mensagens que tenham `instance_friendly_name`.

---

Se precisar de ajuda para localizar exatamente onde adicionar, me avise!
