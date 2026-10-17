---
name: checar-saida
description: Confere todos os JSONs gerados pelo agente para a task reunião em proposta, valida campos, tipos, ordem, integridade e arquivos faltantes. Use depois de gerar out/<caso>.json e antes de finalizar.
---

# Validação de saída

No diretório do workspace, execute:

```bash
node .opencode/skills/checar-saida/check.mjs
npx vitest run tests/public
```

Este validador é **independente** da geração: checa presença de um JSON por pasta em `casos/`, esquema e invariantes de contagem, ordenação e vencimentos. A avaliação oculta cobra os valores exatos; não confunda validação de formato com acerto semântico.

Se encontrar erros, compare com a tabela, transcrição e README do caso. Edite somente os arquivos em `out/` durante a execução do agente. Não altere fontes, testes ou scripts da skill.
