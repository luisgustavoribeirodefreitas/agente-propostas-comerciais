/** Validador independente de JSONs da task reunião em proposta. Somente leitura. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const issues = [];
const assert = (condition, reason) => { if (!condition) issues.push(reason); };
const isInt = value => Number.isSafeInteger(value) && value >= 0;
const isSorted = xs => xs.every((v, i) => i === 0 || xs[i - 1] <= v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = (o, ks) => o !== null && typeof o === 'object' && !Array.isArray(o) && same(Object.keys(o).sort(), ks.slice().sort());
const folders = existsSync('casos') ? readdirSync('casos', { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name) : [];
assert(folders.length > 0, 'Nenhum caso encontrado');
assert(existsSync('out'), 'Pasta out/ ausente');
for (const name of folders) {
  const path = join('out', `${name}.json`);
  if (!existsSync(path)) { issues.push(`Ausente: ${path}`); continue; }
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { issues.push(`${path}: JSON inválido (${error.message})`); continue; }
  const prefix = `${name}`;
  assert(keys(data, ['proposta', 'cronograma', 'riscos', 'pagamento']), `${prefix}: etapas incorretas`);
  const p = data?.proposta, c = data?.cronograma, r = data?.riscos, pay = data?.pagamento;
  if (!p || !c || !r || !pay) continue;
  assert(keys(p, ['escopo', 'fora_do_escopo', 'perguntas_pendentes', 'prazo_semanas', 'preco_centavos']), `${prefix}: campos de proposta`);
  assert(Array.isArray(p.escopo), `${prefix}: escopo não é array`);
  if (Array.isArray(p.escopo)) {
    assert(p.escopo.every(m => keys(m, ['modulo','prioridade','linha']) && typeof m.modulo === 'string' && ['obrigatorio','desejavel','opcional'].includes(m.prioridade) && isInt(m.linha)), `${prefix}: formato de escopo`);
    assert(isSorted(p.escopo.map(m => m.modulo)), `${prefix}: escopo fora de ordem`);
    assert(new Set(p.escopo.map(m => m.modulo)).size === p.escopo.length, `${prefix}: escopo duplicado`);
  }
  for (const field of ['fora_do_escopo','perguntas_pendentes']) {
    assert(Array.isArray(p[field]) && p[field].every(x => typeof x === 'string') && isSorted(p[field]), `${prefix}: lista ${field} inválida`);
  }
  assert(p.prazo_semanas === null || isInt(p.prazo_semanas), `${prefix}: prazo deve ser inteiro ou null`);
  assert(keys(p.preco_centavos, ['essencial', 'recomendado', 'completo']) && Object.values(p.preco_centavos || {}).every(isInt), `${prefix}: preços inválidos`);
  assert(keys(c, ['modulos', 'total_semanas', 'estoura_prazo']), `${prefix}: campos de cronograma`);
  assert(Array.isArray(c.modulos), `${prefix}: cronograma não é array`);
  if (Array.isArray(c.modulos)) {
    assert(c.modulos.every(m => keys(m, ['modulo', 'inicio', 'fim']) && typeof m.modulo === 'string' && isInt(m.inicio) && isInt(m.fim) && m.inicio >= 1 && m.fim >= m.inicio), `${prefix}: módulo de cronograma inválido`);
    assert(c.modulos.every((m, i) => i === 0 || m.inicio === c.modulos[i - 1].fim + 1), `${prefix}: cronograma não sequencial`);
    assert((c.modulos.at(-1)?.fim || 0) === c.total_semanas, `${prefix}: total de semanas inconsistente`);
  }
  assert(isInt(c.total_semanas) && typeof c.estoura_prazo === 'boolean', `${prefix}: tipos de cronograma`);
  if (p.prazo_semanas === null) assert(c.estoura_prazo === false, `${prefix}: sem prazo não pode estourar`);
  else assert(c.estoura_prazo === (c.total_semanas > p.prazo_semanas), `${prefix}: estoura_prazo inconsistente`);
  assert(keys(r, ['ids', 'horas_contingencia', 'preco_recomendado_centavos']), `${prefix}: campos de risco`);
  assert(Array.isArray(r.ids) && r.ids.every(x => typeof x === 'string') && isSorted(r.ids), `${prefix}: riscos.ids inválido`);
  assert(isInt(r.horas_contingencia) && isInt(r.preco_recomendado_centavos), `${prefix}: contigência/preço inválidos`);
  assert(keys(pay, ['forma', 'valor_total_centavos', 'parcelas']), `${prefix}: campos de pagamento`);
  assert(['a_vista', 'parcelado'].includes(pay.forma) && isInt(pay.valor_total_centavos), `${prefix}: tipo/total de pagamento inválido`);
  assert(Array.isArray(pay.parcelas), `${prefix}: parcelas não é array`);
  if (Array.isArray(pay.parcelas)) {
    assert(pay.parcelas.every(item => keys(item, ['tipo', 'semana', 'valor_centavos']) && ['a_vista','entrada','parcela'].includes(item.tipo) && isInt(item.semana) && isInt(item.valor_centavos)), `${prefix}: parcelas inválidas`);
    assert(pay.parcelas.reduce((sum, item) => sum + (item.valor_centavos || 0), 0) === pay.valor_total_centavos, `${prefix}: valores de parcelas não somam o total`);
    if (pay.valor_total_centavos === 0) assert(pay.parcelas.length === 0, `${prefix}: preço zero deveria ter lista vazia`);
    if (pay.forma === 'a_vista' && pay.valor_total_centavos > 0) assert(pay.parcelas.length === 1 && pay.parcelas[0].tipo === 'a_vista' && pay.parcelas[0].semana === 0, `${prefix}: parcela à vista incorreta`);
    if (pay.forma === 'parcelado') assert(pay.parcelas.filter(x => x.tipo === 'entrada').length <= 1 && pay.parcelas.every((x, i) => x.tipo === 'parcela' || (i === 0 && x.tipo === 'entrada')), `${prefix}: ordem das parcelas`);
  }
}
if (issues.length) { console.error(issues.map(x => `- ${x}`).join('\n')); process.exit(1); }
console.log(`PASS: ${folders.length} casos; estrutura, contagens, ordenação e invariantes válidos`);
