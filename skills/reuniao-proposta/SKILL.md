---
name: reuniao-proposta
description: Lê transcrições e dados de reuniões de descoberta e produz propostas comerciais JSON com escopo, preços, cronograma, riscos e parcelas. Usar sempre que a task contiver casos/<caso>/transcricao.txt, catalogo.json, tabela.json, checklist.json, equipe.json e riscos.json.
---

# Reunião → proposta comercial (37 regras oficiais)

## Primeiro, use o solucionador; não calcule tudo na memória

No diretório da task, leia `README.md` e rode:

```bash
node .opencode/skills/reuniao-proposta/solve.mjs
node .opencode/skills/checar-saida/check.mjs
npx vitest run tests/public
```

O script é **parametrizado pelos seis arquivos de cada pasta** e não depende de nomes, preços ou textos específicos de exemplos. Ele lê `casos/`, grava só `out/`, e implementa as quatro etapas encadeadas. Node 22 já está disponível na task. Sem internet, sem instalação de pacotes e sem qualquer alteração no workspace fora de `out/`.

## Contrato de interpretação

1. Considere somente falas rotuladas `Cliente` (inclusive diferentes participantes); ignore toda fala da `Agência`.
2. Segmente a fala pelos sinais `, . ; ! ?`; ignore a oração terminada por `?` em **todas** as etapas.
3. Faça correspondência sem diferenciar maiúsculas, mas exigindo **palavra inteira** e preservando acentos. O ID do módulo não é sinônimo: use apenas `sinonimos` do catálogo.
4. Classifique cada oração uma vez, em ordem de precedência `remocao > opcional > desejavel > obrigatorio`; aplique a todos os módulos mencionados. A última classificação de cada módulo substitui as anteriores. Salve a linha verdadeira `[NNN]`.
5. Interprete o **último** prazo declarado pelo cliente, algarismo ou numeral por extenso, imediatamente antes de `semana(s)` ou `mês/meses`; um mês = quatro semanas. Não invente prazo quando ausente.
6. Marque a pergunta do checklist como respondida somente com oração afirmativa válida contendo alguma `palavras`, sem expressões de incerteza; enumere IDs ainda pendentes alfabeticamente.
7. Calcule pacotes `essencial`, `recomendado`, `completo` com fecho transitivo de dependências, inclusive módulos removidos ou nunca citados. Dependências afetam valores e cronograma, **não** alteram `escopo`/`fora_do_escopo`.
8. Calcule a base pelos papéis, urgência por faixa inclusiva, desconto por horas somadas, arredonde para cima ao múltiplo configurado **apenas ao final** e aplique piso mínimo. Pacote vazio custa zero.
9. Faça o cronograma do `recomendado`: um módulo por vez, dependências antes, maior duração relativa à capacidade de qualquer papel. Ordenação a cada iteração: dependência (grupo 0), obrigatório (1), desejável (2), desempate por ID alfabético.
10. Ative riscos por expressões em qualquer oração do cliente, por prazo estourado e por módulo exigido quando aplicável. Contabilize horas de contingência e **recalcule o preço inteiro** do recomendado (inclusive limiar de desconto de volume).
11. A forma de pagamento e a entrada são decididas pela última expressão relevante, percorrendo cada oração da esquerda para a direita. Respeite os padrões, limite de parcelas, mínimo por parcela, centavos restantes na última e semanas vinculadas aos marcos do cronograma.

## Se houver erro

Execute `node .opencode/skills/checar-saida/check.mjs`; confira o campo apontado contra o README e os seis arquivos do caso. Nunca altere as fontes nem os scripts do agente durante a task. Se o solver falhar com dados inusitados, resolva esses casos lendo o README e escrevendo somente `out/<caso>.json`.

## Formato exigido

- `proposta`: `escopo` (objetos `modulo`, `prioridade`, `linha`), `fora_do_escopo`, `perguntas_pendentes`, `prazo_semanas`, `preco_centavos` (3 pacotes).
- `cronograma`: `modulos` (objetos `modulo`, `inicio`, `fim`), `total_semanas`, `estoura_prazo`.
- `riscos`: `ids`, `horas_contingencia`, `preco_recomendado_centavos`.
- `pagamento`: `forma`, `valor_total_centavos`, `parcelas` (objetos `tipo`, `semana`, `valor_centavos`).

Os valores monetários são inteiros em centavos; `prazo_semanas` pode ser `null`.
