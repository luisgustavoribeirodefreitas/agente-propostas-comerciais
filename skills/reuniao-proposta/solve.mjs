/**
 * Solucionador determinístico e parametrizado do contrato do README da task.
 * Não contém IDs de módulos, valores ou respostas de qualquer caso de exemplo.
 * Lê exclusivamente casos/ e escreve exclusivamente out/.
 * Uso: node .opencode/skills/reuniao-proposta/solve.mjs
 *      node .opencode/skills/reuniao-proposta/solve.mjs --dry-run
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const letters = '[\\p{L}\\p{M}\\p{N}_]';
const numberWords = Object.freeze({
  um: 1, uma: 1, dois: 2, duas: 2, 'três': 3,
  quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, quinze: 15,
  dezesseis: 16, vinte: 20,
});
const numberPattern = `(?:\\d+|${Object.keys(numberWords).join('|')})`;
const priorityRules = [
  ['remocao', ['esquece', 'pode tirar', 'não precisa', 'não precisam', 'não preciso', 'não quero', 'deixa de fora']],
  ['opcional', ['se sobrar', 'se der tempo']],
  ['desejavel', ['seria bom', 'gostaria']],
  ['obrigatorio', ['precisa', 'precisam', 'preciso', 'precisamos', 'tem que ter', 'obrigatório']],
];

/** Não normalizar acentos: as regras distinguem 'não' de 'nao'. */
function escapeRx(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function wholeRx(phrase, global = false) {
  return new RegExp(`(?<!${letters})${escapeRx(phrase)}(?!${letters})`, global ? 'giu' : 'iu');
}
function matches(text, phrase) { return Boolean(phrase) && wholeRx(phrase).test(text); }
function matchesAny(text, phrases = []) { return phrases.some(p => matches(text, p)); }
function matchAllWhole(text, phrase) { return [...text.matchAll(wholeRx(phrase, true))].map(m => ({ index: m.index, value: m[0] })); }
function toNumber(word) {
  const v = String(word).toLocaleLowerCase('pt-BR');
  return /^\d+$/u.test(v) ? Number(v) : numberWords[v];
}
const qtyRx = (end) => new RegExp(`(?<!${letters})(${numberPattern})\\s+(${end})(?!${letters})`, 'giu');
const prazoRx = qtyRx('semanas?|meses|mês');
const parcelasRx = qtyRx('parcelas?');
const percentRx = /(?<![\p{L}\p{M}\p{N}_])([0-9]+)%(?![\p{L}\p{M}\p{N}_])/giu;

function readJson(folder, name) { return JSON.parse(readFileSync(join(folder, name), 'utf8')); }

function clientClauses(transcript) {
  const clauses = [];
  for (const text of transcript.split(/\r?\n/u)) {
    // A única origem permitida para decisões é uma linha rotulada Cliente.
    const line = text.match(/^\s*\[(\d+)\]\s*Cliente\s*(?:\([^\n)]*\)\s*)?:\s*(.*)$/iu);
    if (!line) continue;
    const n = Number(line[1]);
    for (const part of line[2].matchAll(/([^,.;!?]+)([,.;!?]|$)/gu)) {
      const sentence = part[1].trim();
      if (!sentence || part[2] === '?') continue;
      clauses.push({ line: n, text: sentence });
    }
  }
  return clauses;
}

/** Montantes exatos: todas as porcentagens são convertidas a frações decimais via string. */
function fraction(value) {
  const str = String(value);
  if (!/^\d+(?:\.\d+)?$/u.test(str)) throw new Error(`Percentual ou valor inválido: ${str}`);
  const [int, dec = ''] = str.split('.');
  return { n: BigInt(int + dec), d: 10n ** BigInt(dec.length) };
}
function floorDiv(n, d) { if (d <= 0n || n < 0n) throw new Error('Divisão financeira inválida'); return n / d; }
function roundUpToMultiple(numer, denom, step) {
  if (step <= 0n) throw new Error('Arredondamento deve ser positivo');
  const unit = step * denom;
  return ((numer + unit - 1n) / unit) * step;
}
function moneyNumber(bigint) {
  const n = Number(bigint);
  if (!Number.isSafeInteger(n)) throw new Error('Resultado financeiro excede inteiro seguro');
  return n;
}
function percentageFloor(amount, pct) {
  const p = fraction(pct);
  return floorDiv(BigInt(amount) * p.n, 100n * p.d);
}

function solveCase(folder) {
  const catalog = readJson(folder, 'catalogo.json');
  const table = readJson(folder, 'tabela.json');
  const checklist = readJson(folder, 'checklist.json');
  const team = readJson(folder, 'equipe.json');
  const riskCatalog = readJson(folder, 'riscos.json');
  const clauses = clientClauses(readFileSync(join(folder, 'transcricao.txt'), 'utf8'));
  const moduleIds = Object.keys(catalog).sort();
  const states = new Map();
  let deadline = null;
  const answers = new Set();

  for (const clause of clauses) {
    const { text, line } = clause;
    const priority = priorityRules.find(([, expressions]) => matchesAny(text, expressions))?.[0];
    if (priority) {
      for (const id of moduleIds) {
        if (matchesAny(text, catalog[id].sinonimos || [])) states.set(id, { priority, line });
      }
    }
    for (const token of text.matchAll(prazoRx)) {
      const quantity = toNumber(token[1]);
      deadline = /^m/u.test(token[2].toLocaleLowerCase('pt-BR')) ? quantity * 4 : quantity;
    }
    if (!matchesAny(text, ['não sei', 'vou ver', 'não decidimos'])) {
      for (const question of checklist) {
        if (matchesAny(text, question.palavras || [])) answers.add(question.id);
      }
    }
  }
  const scope = moduleIds.filter(id => states.has(id) && states.get(id).priority !== 'remocao')
    .map(id => ({ modulo: id, prioridade: states.get(id).priority, linha: states.get(id).line }));
  const excluded = moduleIds.filter(id => states.get(id)?.priority === 'remocao');
  const unanswered = checklist.map(item => item.id).filter(id => !answers.has(id)).sort();

  function expandDependencies(initialIds) {
    const selected = new Set();
    function visit(id, ancestors = new Set()) {
      if (!(id in catalog)) throw new Error(`Dependência desconhecida: ${id}`);
      if (ancestors.has(id)) throw new Error(`Ciclo de dependências: ${[...ancestors, id].join(' -> ')}`);
      if (selected.has(id)) return;
      ancestors.add(id);
      for (const dep of catalog[id].requer || []) visit(dep, ancestors);
      ancestors.delete(id);
      selected.add(id);
    }
    for (const id of initialIds) visit(id);
    return selected;
  }
  const baseIds = scope.filter(m => m.prioridade === 'obrigatorio').map(m => m.modulo);
  const recommendedIds = scope.filter(m => ['obrigatorio', 'desejavel'].includes(m.prioridade)).map(m => m.modulo);
  const allIds = scope.map(m => m.modulo);
  const essential = expandDependencies(baseIds);
  const recommended = expandDependencies(recommendedIds);
  const complete = expandDependencies(allIds);

  function countHours(ids, risks = []) {
    const hours = {};
    const accumulate = breakdown => {
      for (const [role, quantity] of Object.entries(breakdown || {})) {
        hours[role] = (hours[role] || 0) + quantity;
      }
    };
    for (const id of ids) accumulate(catalog[id].horas);
    for (const risk of risks) accumulate(risk.horas);
    return hours;
  }
  function price(ids, riskItems = []) {
    if (!ids.size) return 0;
    const hours = countHours(ids, riskItems);
    let totalHours = 0;
    let base = 0n;
    for (const [role, quantity] of Object.entries(hours)) {
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error(`Horas inválidas para ${role}`);
      const hourlyRate = table.valor_hora_centavos[role];
      if (!Number.isSafeInteger(hourlyRate)) throw new Error(`Valor/hora ausente para ${role}`);
      totalHours += quantity;
      base += BigInt(quantity) * BigInt(hourlyRate);
    }
    const urgent = deadline === null ? null : [...(table.urgencia || [])]
      .filter(f => deadline <= f.ate_semanas).sort((a, b) => a.ate_semanas - b.ate_semanas)[0];
    const multiplier = fraction(urgent?.pct ?? 100);
    const discount = fraction(totalHours >= table.desconto_volume.horas_minimas ? table.desconto_volume.pct : 0);
    const num = base * multiplier.n * (100n * discount.d - discount.n);
    const den = 10000n * multiplier.d * discount.d;
    const round = BigInt(table.arredondamento_centavos);
    const rounded = roundUpToMultiple(num, den, round);
    return moneyNumber(rounded < BigInt(table.minimo_centavos) ? BigInt(table.minimo_centavos) : rounded);
  }
  const prices = { essencial: price(essential), recomendado: price(recommended), completo: price(complete) };

  const completed = new Set();
  const schedule = [];
  const remaining = new Set(recommended);
  const group = id => states.get(id)?.priority === 'obrigatorio' ? 1 :
    states.get(id)?.priority === 'desejavel' ? 2 : 0;
  let lastWeek = 0;
  while (remaining.size) {
    const eligible = [...remaining].filter(id => (catalog[id].requer || []).every(dep => completed.has(dep)));
    eligible.sort((a, b) => group(a) - group(b) || (a < b ? -1 : a > b ? 1 : 0));
    if (!eligible.length) throw new Error('Impossível montar cronograma: dependência circular');
    const id = eligible[0];
    let duration = 0;
    for (const [role, hours] of Object.entries(catalog[id].horas || {})) {
      if (!hours) continue;
      const capacity = team[role]?.pessoas * team[role]?.horas_semana;
      if (!capacity || capacity <= 0) throw new Error(`Capacidade inexistente para ${role}`);
      duration = Math.max(duration, Math.ceil(hours / capacity));
    }
    const start = lastWeek + 1;
    lastWeek = start + duration - 1;
    schedule.push({ modulo: id, inicio: start, fim: lastWeek });
    remaining.delete(id);
    completed.add(id);
  }
  const exceedsDeadline = deadline !== null && lastWeek > deadline;

  const activeRisks = riskCatalog.filter(risk => {
    if (risk.modulo && !recommended.has(risk.modulo)) return false;
    return (risk.gatilho === 'estoura_prazo' && exceedsDeadline) ||
      (Array.isArray(risk.sinais) && clauses.some(clause => matchesAny(clause.text, risk.sinais)));
  });
  const riskHours = activeRisks.reduce((sum, risk) => sum + Object.values(risk.horas || {}).reduce((a, b) => a + b, 0), 0);
  const riskPrice = price(recommended, activeRisks);

  const payTable = table.pagamento;
  let paymentForm = 'parcelado';
  let numberInstallments = payTable.parcelas_padrao;
  let downPaymentPct = payTable.entrada_pct_padrao;
  for (const { text } of clauses) {
    const formEvents = [];
    for (const m of matchAllWhole(text, 'à vista')) formEvents.push({ at: m.index, form: 'a_vista' });
    for (const token of text.matchAll(parcelasRx)) formEvents.push({ at: token.index, form: 'parcelado', n: toNumber(token[1]) });
    formEvents.sort((a, b) => a.at - b.at);
    for (const event of formEvents) {
      paymentForm = event.form;
      if (event.form === 'parcelado') numberInstallments = event.n;
    }
    const entryEvents = [];
    for (const m of matchAllWhole(text, 'sem entrada')) entryEvents.push({ at: m.index, pct: 0 });
    if (matches(text, 'entrada')) {
      for (const token of text.matchAll(percentRx)) entryEvents.push({ at: token.index, pct: Number(token[1]) });
    }
    entryEvents.sort((a, b) => a.at - b.at);
    for (const event of entryEvents) downPaymentPct = event.pct;
  }
  const parts = [];
  let paymentTotal = riskPrice;
  if (riskPrice > 0 && paymentForm === 'a_vista') {
    // OBS: para 'à vista' a regra é floor(preço * (100 - pct) / 100),
    // não 'preço - floor(desconto)', pois difere em centavos fracionários.
    paymentTotal = moneyNumber(percentageFloor(riskPrice, 100 - payTable.desconto_a_vista_pct));
    parts.push({ tipo: 'a_vista', semana: 0, valor_centavos: paymentTotal });
  } else if (riskPrice > 0) {
    const upfront = moneyNumber(percentageFloor(riskPrice, downPaymentPct));
    if (upfront) parts.push({ tipo: 'entrada', semana: 0, valor_centavos: upfront });
    const rest = riskPrice - upfront;
    let n = Math.max(1, Math.min(numberInstallments, payTable.max_parcelas));
    if (Math.floor(rest / n) < payTable.parcela_minima_centavos && payTable.parcela_minima_centavos > 0) {
      n = Math.max(1, Math.floor(rest / payTable.parcela_minima_centavos));
    }
    const each = Math.floor(rest / n);
    for (let i = 1; i <= n; i++) {
      const position = Math.ceil(schedule.length * i / n);
      const week = schedule[position - 1]?.fim ?? lastWeek;
      parts.push({ tipo: 'parcela', semana: week, valor_centavos: i === n ? rest - each * (n - 1) : each });
    }
  }

  return {
    proposta: {
      escopo: scope,
      fora_do_escopo: excluded,
      perguntas_pendentes: unanswered,
      prazo_semanas: deadline,
      preco_centavos: prices,
    },
    cronograma: { modulos: schedule, total_semanas: lastWeek, estoura_prazo: exceedsDeadline },
    riscos: { ids: activeRisks.map(r => r.id).sort(), horas_contingencia: riskHours, preco_recomendado_centavos: riskPrice },
    pagamento: { forma: paymentForm, valor_total_centavos: paymentTotal, parcelas: parts },
  };
}

function main() {
  const input = join(root, 'casos');
  if (!existsSync(input)) throw new Error('Diretório casos/ não encontrado');
  const caseNames = readdirSync(input, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  if (!caseNames.length) throw new Error('Nenhuma pasta de caso encontrada');
  const results = caseNames.map(name => [name, solveCase(join(input, name))]);
  if (process.argv.includes('--dry-run')) {
    for (const [name, result] of results) console.log(`${name}: ${JSON.stringify(result)}`);
    return;
  }
  mkdirSync(join(root, 'out'), { recursive: true });
  for (const [name, result] of results) {
    const path = join(root, 'out', `${name}.json`);
    writeFileSync(path, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`OK ${path}: ${result.proposta.escopo.length} escopo, ${result.cronograma.modulos.length} cronograma, ${result.riscos.ids.length} riscos`);
  }
}

try { main(); } catch (e) { console.error(`ERRO: ${e.message}`); process.exitCode = 1; }
