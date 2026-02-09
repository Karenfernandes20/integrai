# 💰 Módulo Financeiro Clínico Avançado

Módulo especializado para clínicas e consultórios, ativado automaticamente para o perfil "Saúde".

## 🎯 Funcionalidades

### 1. Dashboard Especializado
Diferente do financeiro genérico ("Contas a Pagar/Receber"), este dashboard foca em métricas de produtividade médica:
- **Receita por Convênio**: Rankeamento das operadoras que mais geram receita.
- **Produção por Profissional**: Quanto cada médico/dentista gerou no período.
- **Ticket Médio**: Receita total / número de atendimentos pagos.
- **Fluxo de Caixa Diário**: Gráfico de barras comparativo (Entradas x Saídas).

### 2. Gestão de Contas Médicas
Suporte nativo a conceitos da área de saúde:
- **Paciente**: Vínculo do recebimento ao cadastro do paciente.
- **Profissional**: Vínculo do recebimento ao profissional executante (útil para cálculo de comissões).
- **Convênio**: Identificação da fonte pagadora (Unimed, Bradesco, Particular, etc.).
- **Tipo de Procedimento**: Consulta, Exame, Cirurgia (Campo aberto ou lista).

### 3. Estrutura de Dados
A tabela `financial_transactions` foi estendida (sem quebrar compatibilidade) com colunas:
- `patient_id` (Integração com CRM)
- `professional_id` (Integração com RH/Profissionais)
- `insurance_plan_id` (Integração com Tabela de Convênios)
- `procedure_type`
- `attachment_url` (Comprovantes/Guias)

## 🛠 Como Ativar

O módulo é ativado automaticamente baseado no perfil da empresa:
- `user.company.operational_profile === 'CLINICA'`
- OU `user.company.operation_type === 'pacientes'`

## 🚀 Próximos Passos (Sugestões)
1. **Repasse Médico**: Criar uma ferramenta para calcular automaticamente a comissão do médico baseada nos recebimentos vinculados a ele.
2. **Glosas**: Controle específico de recursos de glosas de convênio.
3. **Emissão de TISS**: Gerar arquivo XML TISS a partir dos lançamentos.
4. **Integração com Agenda**: Botão "Gerar Recebimento" direto no agendamento.
