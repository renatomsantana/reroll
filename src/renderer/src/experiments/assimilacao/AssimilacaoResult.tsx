import { useState } from 'react'
import type { RollResult } from '@shared/types/dice'
import { BotaoCopiar } from '../../components/common/BotaoCopiar'
import { Button } from '../../components/common/Button'
import { contarSimbolos, dadoAssimilacao, quantidadeSimbolo, resumoAssimilacao, resultadoSimples, selecionarDados, simbolosDaFace, type FaceAssimilacao, type SimboloAssimilacao, type TotaisAssimilacao } from './d12'
import { SYMBOL_ART, SYMBOL_NAMES } from './symbols'
import './AssimilacaoResult.css'

const STORAGE_KEY = 'reroll:assimilacao:testes:v1'
const ORDEM = ['sucesso', 'adaptacao', 'pressao'] as const
export interface RegistroAssimilacao {
  id: string
  timestamp: number
  nome: string
  anotacao: string
  faces: FaceAssimilacao[]
  indices: number[]
  simples: boolean
  todos: boolean
}

export function lerRegistros(raw: string | null): RegistroAssimilacao[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is RegistroAssimilacao => {
      if (!item || typeof item !== 'object') return false
      const r = item as RegistroAssimilacao
      if (typeof r.id !== 'string' || !Number.isFinite(r.timestamp) || !Number.isFinite(new Date(r.timestamp).getTime()) || typeof r.nome !== 'string' || typeof r.anotacao !== 'string' || typeof r.simples !== 'boolean' || typeof r.todos !== 'boolean' || !Array.isArray(r.faces) || !Array.isArray(r.indices) || !r.indices.length) return false
      if (!r.faces.length || r.faces.length > 100 || !r.faces.every(f => f && dadoAssimilacao(f.sides) && Number.isInteger(f.value) && f.value >= 1 && f.value <= f.sides)) return false
      try { selecionarDados(r.faces, r.indices, r.faces.length); return true } catch { return false }
    }).slice(0, 50)
  } catch { return [] }
}
export function textoDoRegistro(r: RegistroAssimilacao): string {
  const total = contarSimbolos(selecionarDados(r.faces, r.indices, r.faces.length))
  const final = r.simples ? resultadoSimples(total) : total
  const pool = [6, 10, 12].flatMap(sides => {
    const count = r.faces.filter(f => f.sides === sides).length
    return count ? [`${count}d${sides}`] : []
  }).join(' + ')
  const dados = r.indices.map(i => {
    const f = r.faces[i]
    return `d${f.sides}: ${simbolosDaFace(f.value, f.sides).map(s => SYMBOL_NAMES[s]).join(' + ') || 'vazio'}`
  }).join('; ')
  const bruto = resumoAssimilacao(selecionarDados(r.faces, r.indices, r.faces.length))
  const resolvido = r.simples ? `\nAção simples: ${quantidadeSimbolo(final.adaptacao, 'adaptacao')} · ${quantidadeSimbolo(final.pressao, 'pressao')}.` : ''
  return `${r.nome || 'Teste de Assimilação'} — ${pool}\nMantidos ${r.indices.length}/${r.faces.length}: ${dados}\n${bruto}${resolvido}${r.anotacao ? `\nNota: ${r.anotacao}` : ''}`
}
export function AssimilacaoIcon({ symbol }: { symbol: SimboloAssimilacao }) {
  const art = SYMBOL_ART[symbol]
  return <svg viewBox="0 0 100 100" aria-hidden="true" className="assimilacao-icon">
    <path d={art.fill} fill="currentColor" fillRule="evenodd" />
    {art.stroke && <path d={art.stroke} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
}
function Totais({ total }: { total: TotaisAssimilacao }) {
  return <div className="assimilacao-totals" aria-label="Símbolos dos dados mantidos">
    {ORDEM.map(symbol => <span key={symbol} className={`assimilacao-count assimilacao-${symbol}`} aria-label={`${SYMBOL_NAMES[symbol]}: ${total[symbol]}`}>
      <AssimilacaoIcon symbol={symbol} /><strong>{total[symbol]}</strong><small>{SYMBOL_NAMES[symbol]}</small>
    </span>)}
  </div>
}
function Selecao({ result, limite, todos, simples, nome, onRegister }: {
  result: RollResult; limite: number; todos: boolean; simples: boolean; nome: string
  onRegister: (registro: RegistroAssimilacao) => string
}) {
  const faces: FaceAssimilacao[] = result.groups.flatMap(g => dadoAssimilacao(g.sides) ? g.rolls.map(value => ({ sides: g.sides as FaceAssimilacao['sides'], value })) : [])
  const [indices, setIndices] = useState<number[]>(todos ? faces.map((_, i) => i) : [])
  const [anotacao, setAnotacao] = useState('')
  const [registrado, setRegistrado] = useState(false)
  const [status, setStatus] = useState('')
  const limiteEfetivo = Math.max(1, Math.min(limite, faces.length))
  const selected = selecionarDados(faces, indices, todos ? Math.max(1, faces.length) : limiteEfetivo)
  const total = contarSimbolos(selected)
  const final = simples ? resultadoSimples(total) : total
  const registro: RegistroAssimilacao = { id: result.id, timestamp: result.timestamp, nome: nome.trim(), anotacao: anotacao.trim(), faces, indices, simples, todos }
  function toggle(index: number) {
    if (registrado || todos) return
    setIndices(current => current.includes(index) ? current.filter(i => i !== index) : limiteEfetivo === 1 ? [index] : current.length < limiteEfetivo ? [...current, index] : current)
  }
  return <section className="assimilacao-selection" aria-label="Escolha dos dados mantidos">
    <div className="assimilacao-section-heading"><h3>{registrado ? 'Teste registrado' : 'Escolha seus dados'}</h3><span>{indices.length}/{todos ? faces.length : limiteEfetivo} mantidos</span></div>
    {nome && <p className="assimilacao-test-name">{nome}</p>}
    <p className="assimilacao-help">{todos ? 'Todos os dados entram na contagem desta rolagem.' : 'Clique nas faces que deseja manter. Todos os símbolos da face escolhida contam juntos.'}</p>
    <div className="assimilacao-faces" aria-label="Dados rolados">
      {faces.map((face, i) => {
        const symbols = simbolosDaFace(face.value, face.sides)
        const kept = indices.includes(i)
        const description = symbols.map(s => SYMBOL_NAMES[s]).join(', ') || 'vazio'
        return <button type="button" key={i} className={`assimilacao-face${kept ? ' assimilacao-face-kept' : ''}`} aria-pressed={kept} aria-label={`Dado ${i + 1}, d${face.sides}: ${description}`} title={`Face numérica ${face.value}`} disabled={registrado || todos || (!kept && limiteEfetivo > 1 && indices.length >= limiteEfetivo)} onClick={() => toggle(i)}>
          <span className="assimilacao-face-symbols">{symbols.length ? symbols.map((s, j) => <AssimilacaoIcon key={j} symbol={s} />) : <span className="assimilacao-blank">—</span>}</span>
          <small>d{face.sides}</small><span className="assimilacao-kept-label">{kept ? 'Mantido' : 'Escolher'}</span>
        </button>
      })}
    </div>
    <Totais total={total} />
    {simples && indices.length > 0 && <p className="assimilacao-resolution">Ação simples: {quantidadeSimbolo(total.pressao - final.pressao, 'pressao')} {total.pressao - final.pressao === 1 ? 'evitada' : 'evitadas'} com adaptação. Restam <strong>{quantidadeSimbolo(final.adaptacao, 'adaptacao')}</strong> e <strong>{quantidadeSimbolo(final.pressao, 'pressao')}</strong>.</p>}
    <label className="assimilacao-note">Anotação do teste<textarea value={anotacao} disabled={registrado} onChange={e => setAnotacao(e.target.value)} maxLength={1500} rows={2} placeholder="Ex.: forcei a porta e atraí a atenção da criatura." /></label>
    <div className="assimilacao-actions"><Button disabled={registrado || !indices.length} onClick={() => { setStatus(onRegister(registro)); setRegistrado(true) }}>Registrar teste</Button>{indices.length > 0 && <BotaoCopiar texto={() => textoDoRegistro(registro)} />}<span role="status">{status}</span></div>
  </section>
}
export function AssimilacaoDesk({ result, rolling, limite, todos, simples, nome }: {
  result: RollResult | null; rolling: boolean; limite: number; todos: boolean; simples: boolean; nome: string
}) {
  const [history, setHistory] = useState<RegistroAssimilacao[]>(() => {
    try { return lerRegistros(localStorage.getItem(STORAGE_KEY)) } catch { return [] }
  })
  function register(registro: RegistroAssimilacao): string {
    const next = [registro, ...history.filter(r => r.id !== registro.id)].slice(0, 50)
    setHistory(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return 'Salvo neste navegador.' } catch { return 'Registrado nesta sessão. O navegador não permitiu salvar.' }
  }
  return <div className="assimilacao-desk">
    {rolling ? <p role="status">Rolando os dados…</p> : result ? <Selecao key={`${result.id}-${limite}-${todos}-${simples}`} result={result} limite={limite} todos={todos} simples={simples} nome={nome} onRegister={register} /> : <div className="assimilacao-empty"><h3>Monte sua pilha e role</h3><p>Adicione d6, d10 e d12. Depois escolha os dados que vai manter para formar seu resultado.</p></div>}
    <details className="assimilacao-history">
      <summary>Histórico de testes <span>{history.length}</span></summary>
      <p className="assimilacao-help">Últimos 50 testes, salvos somente neste navegador.</p>
      {!history.length && <p>Nenhum teste registrado ainda.</p>}
      {history.map(r => <article key={r.id} className="assimilacao-history-entry"><header><strong>{r.nome || 'Teste de Assimilação'}</strong><time dateTime={new Date(r.timestamp).toISOString()}>{new Date(r.timestamp).toLocaleString('pt-BR')}</time><BotaoCopiar texto={() => textoDoRegistro(r)} /></header><pre>{textoDoRegistro(r)}</pre></article>)}
    </details>
    <details className="assimilacao-rules"><summary>Como ler os resultados</summary><p>Por padrão, o Infectado mantém um dado. Origens, Determinação e outras regras podem aumentar esse limite; ajuste-o conforme sua mesa. Você escolhe a face inteira, com seus sucessos, adaptações e pressões.</p><p>Em Ação simples, cada adaptação evita uma pressão mantida. Para Conflitos e rolagens especiais, use a contagem bruta e anote como os símbolos foram usados. Rolagens assimiladas têm regras próprias; monte a pilha e ajuste os mantidos conforme o livro.</p><p>Este rolador não gasta recursos da ficha nem escolhe dados por você.</p></details>
  </div>
}
