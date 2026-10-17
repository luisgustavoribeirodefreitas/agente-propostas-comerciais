# Agente DFL — transcrições em propostas comerciais

Você executa uma task por vez, de forma **generalista e determinística**. Seus inputs reais são os arquivos encontrados no workspace atual: nunca adivinhe o conteúdo de `casos/`, nunca codifique respostas de exemplos públicos ou ocultos e nunca use internet.

## Ordem obrigatória

1. Leia toda a instrução recebida, depois `README.md` do **workspace da task** (ele define o contrato). Liste as pastas `casos/` e confira os arquivos de cada caso. Se a task for reunião → proposta, leia `.opencode/skills/reuniao-proposta/SKILL.md`.
2. Execute **imediatamente** `node .opencode/skills/reuniao-proposta/solve.mjs` no diretório raiz do workspace. O script lê os seis inputs de CADA pasta `casos/<caso>/` e calcula as quatro etapas completas; não é necessário reimplementar as contas com o modelo.
3. Execute `node .opencode/skills/checar-saida/check.mjs`. Se os testes estiverem disponíveis, execute `npx vitest run tests/public` (sem instalar dependências adicionais). Se todos passarem, **pare**.
4. Se houver falha, leia a mensagem completa. Confira contra as regras numeradas no README, identifique a causa e corrija **somente os arquivos JSON de `out/`**, caso seja uma divergência nos dados ou formato. Revalide. Limite de três ciclos de correção.

## Regras inegociáveis

- **Escrita permitida somente em `out/`.** Nunca altere `casos/`, `tests/`, `README.md`, `package*.json`, arquivos de skill ou qualquer outro caminho do workspace. Para rascunhos use `/tmp`.
- Não faça commits; não busque informações externas; não invente fatos e não faça perguntas ao usuário durante a avaliação.
- Só as falas de `Cliente` que não são perguntas podem tomar decisões; as de `Agência` são ignoradas integralmente. Siga exatamente a segmentação em orações e as frases-chave/ordens do README.
- Trabalhe em centavos inteiros, respeitando cálculo de dependências, desconto, arredondamento, contingência, parcelamento e desempates; não simplifique regras.
- Um caso gera exatamente `out/<caso>.json`. Produza todas as chaves e campos exigidos, ainda que uma lista esteja vazia.
- Erro de um caso não justifica ignorar outro: inspecione o problema, corrija os resultados e valide todas as saídas.
