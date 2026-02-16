# ⭐ Prompt modelo para gerar código com OpenAI Codex

Este template foi estruturado para maximizar a qualidade das respostas do Codex com:
- objetivo claro,
- contexto suficiente,
- formato de saída definido,
- critérios de aceitação testáveis.

## 🧠 Prompt base (copiar e preencher)

```txt
Você é um assistente de codificação especialista.

Tarefa:
Escreva código em [LINGUAGEM_DESEJADA] para a seguinte necessidade:

Descrição:
[DESCREVA A FUNÇÃO/IMPLEMENTAÇÃO COM DETALHES]
Inclua:
- Comentários explicativos
- Tratamento de erros
- Exemplos de uso

Regras:
1. O código deve ser funcional e testável.
2. Use boas práticas da linguagem.
3. Forneça um teste básico no final (se aplicável).

Entrada:
[EXEMPLO_DE_ENTRADA]

Saída esperada:
[EXEMPLO_DE_SAÍDA]

Comece agora.
```

## 🧩 Como preencher

- **[LINGUAGEM_DESEJADA]**: Python, JavaScript, TypeScript, SQL etc.
- **[DESCREVA A FUNÇÃO/IMPLEMENTAÇÃO COM DETALHES]**: descreva comportamento, validações, restrições e casos limite.
- **[EXEMPLO_DE_ENTRADA]**: dados reais que representem uso prático.
- **[EXEMPLO_DE_SAÍDA]**: resultado esperado para validar se a implementação está correta.

## ✅ Exemplo prático preenchido

```txt
Você é um assistente de codificação especialista.

Tarefa:
Escreva código em Python para a seguinte necessidade:

Descrição:
Crie uma função `calcular_media_notas` que receba uma lista de notas,
valide cada nota entre 0 e 10, calcule a média e retorne como float.
Inclua:
- Comentários explicativos
- Tratamento de erros (valores fora do intervalo)
- Um exemplo de chamada da função

Regras:
1. O código deve ser funcional e testável.
2. Use boas práticas de Python.
3. Forneça um teste básico no final.

Entrada:
[8.0, 7.5, 9.2]

Saída esperada:
8.23

Comece agora.
```

## 🔧 Versão avançada (mais precisa)

Use esta versão quando quiser respostas mais determinísticas:

```txt
Você é um assistente de codificação especialista em [LINGUAGEM_DESEJADA].

Objetivo:
Implementar [NOME_DA_FUNÇÃO/FEATURE] para [CONTEXTO_DO_PROJETO].

Requisitos funcionais:
1. [REQUISITO_1]
2. [REQUISITO_2]
3. [REQUISITO_3]

Requisitos não funcionais:
- Legibilidade e manutenção.
- Complexidade esperada: [ex.: O(n)].
- Compatibilidade: [VERSÃO_DA_LINGUAGEM/RUNTIME].

Critérios de validação:
- Dado [ENTRADA_A], retornar [SAÍDA_A].
- Dado [ENTRADA_B], lançar/retornar [ERRO_OU_RESULTADO_B].

Formato da resposta:
1. Código completo.
2. Explicação curta da abordagem.
3. Testes mínimos executáveis.
4. Exemplo de execução.

Restrições:
- Não usar bibliotecas externas, exceto [LISTA_PERMITIDA].
- Não omitir tratamento de erros.

Comece agora.
```

## 💡 Dicas rápidas para melhor resultado

- Seja específico sobre regras de negócio e validações.
- Inclua exemplos com casos normais e casos de erro.
- Defina formato da saída para evitar respostas vagas.
- Indique versão da linguagem/framework quando relevante.
- Se houver código existente, mencione arquivos/funções que devem ser respeitados.
