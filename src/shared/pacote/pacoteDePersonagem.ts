import { normalizeNotes, type NotesData } from '../types/notes'
import { favoritoSaneado, type PresetInput } from '../types/preset'
import { TAMANHO_MAXIMO_DO_NOME, fotoDePerfilValida, type Profile } from '../types/profile'
import { sanearAparencia, type AparenciaDoPersonagem } from '../types/aparencia'
import { MAXIMO_DE_PRESETS_POR_PERSONAGEM } from '../diceRegistry'

/**
 * O PACOTE DE PERSONAGEM — o personagem inteiro num arquivo só (spec §3.2: "profile export/import
 * (single file) so users can back up or move characters").
 *
 * Pedido do usuário: "um exportável de ficha, para a pessoa poder mostrar pro mestre a ficha ou
 * talvez usar isso para fazer upload em outro pc, ter um jeito de já estar tudo ajeitadinho, com
 * designs dos dados, anotações, presets — pra que alguém que já use bastante não perca suas
 * informações".
 *
 * São DOIS usos num arquivo só, e o formato é o que faz os dois caberem:
 *
 * - MOSTRAR AO MESTRE: o arquivo é um `.html` que abre em qualquer navegador, sem o app, com a
 *   ficha desenhada — nome, foto, barras, seções, blocos, presets (ver `htmlDoPacote.ts`);
 * - LEVAR PRA OUTRO PC: dentro do mesmo HTML vai o pacote em JSON, num `<script type=
 *   "application/json">` que o navegador ignora e o Reroll lê de volta. Importar cria o
 *   personagem com tudo o que ele tinha — ficha, diário, barras, descansos, HUD, presets COM as
 *   estrelas, foto e a aparência dos dados.
 *
 * A estrela vai junto de propósito, ao contrário da exportação de presets soltos (ver o comentário
 * de `favorito` em `preset.ts`): lá o arquivo é pra dar presets a OUTRA pessoa; aqui é a mesma
 * pessoa levando o personagem dela pra outra máquina, e a fileira de favoritos é parte do "tudo
 * ajeitadinho".
 *
 * O que NÃO vai: preferências de quem usa o app (idioma, tema, fonte, som) — não são do
 * personagem — e o histórico de rolagens, que é da sessão.
 */
export const FORMATO_DO_PACOTE = 'reroll-personagem'
export const VERSAO_DO_PACOTE = 1

/**
 * O maior arquivo que o app abre como pacote. A conta é a soma dos tetos do que ele carrega: foto
 * (17 MB em base64) + imagem de fundo (17 MB) + anotações (16 MB) + presets (2 MB), com folga pro
 * HTML em volta. Acima disso não é pacote, é outra coisa escolhida por engano — e o ponto do teto
 * é recusar ANTES de ler os bytes pra memória (ver `lerPacoteDoArquivo`).
 */
export const TAMANHO_MAXIMO_DO_PACOTE = 64 * 1024 * 1024

export type PresetDoPacote = PresetInput & { favorito?: number }

export interface PacoteDePersonagem {
  formato: typeof FORMATO_DO_PACOTE
  versao: number
  /** Versão do Reroll que exportou — vai pro rodapé do HTML e ajuda a entender um arquivo velho. */
  app: string
  /** ISO 8601. */
  exportadoEm: string
  personagem: Pick<Profile, 'name' | 'system' | 'photo'>
  ficha: NotesData
  presets: PresetDoPacote[]
  aparencia: AparenciaDoPersonagem | null
}

export function montarPacote(dados: {
  perfil: Pick<Profile, 'name' | 'system' | 'photo'>
  ficha: NotesData
  presets: Array<PresetInput & { favorito?: number }>
  aparencia: AparenciaDoPersonagem | null
  versaoDoApp: string
  agora: Date
}): PacoteDePersonagem {
  return {
    formato: FORMATO_DO_PACOTE,
    versao: VERSAO_DO_PACOTE,
    app: dados.versaoDoApp,
    exportadoEm: dados.agora.toISOString(),
    personagem: { name: dados.perfil.name, system: dados.perfil.system, photo: dados.perfil.photo },
    ficha: dados.ficha,
    presets: dados.presets.map(({ name, icon, expression, formula, favorito }) => ({
      name,
      ...(icon !== undefined ? { icon } : {}),
      ...(expression !== undefined ? { expression } : {}),
      ...(formula !== undefined ? { formula } : {}),
      ...(favorito !== undefined ? { favorito } : {})
    })),
    aparencia: dados.aparencia
  }
}

/**
 * O JSON que fica dentro do HTML. `<` vira `<` porque um nome de preset com `</script>`
 * dentro fecharia o bloco no meio e o navegador tentaria executar o resto como página — é a
 * mesma escapada que todo mundo faz ao embutir JSON em HTML, e o `JSON.parse` a desfaz sozinho.
 */
export const ID_DO_BLOCO_JSON = 'reroll-personagem'

export function serializarPacote(pacote: PacoteDePersonagem): string {
  return JSON.stringify(pacote).replace(/</g, '\\u003c')
}

/**
 * Acha o pacote no texto do arquivo: ou é o JSON puro (alguém salvou só o bloco), ou é o HTML com o
 * bloco dentro. Qualquer outra coisa não é um pacote — e a mensagem diz isso, em vez de um erro de
 * análise de JSON.
 */
export function extrairPacoteDoTexto(texto: string): unknown {
  const aparado = texto.trimStart()
  if (aparado.startsWith('{')) return JSON.parse(aparado)
  const bloco = new RegExp(`<script id="${ID_DO_BLOCO_JSON}" type="application/json">([\\s\\S]*?)</script>`).exec(texto)
  if (!bloco) throw new Error('Este arquivo não é um personagem exportado pelo Reroll.')
  return JSON.parse(bloco[1])
}

/**
 * O pacote conferido, na forma que o app grava. Estrutura errada ESTOURA (não é um pacote, ou é de
 * uma versão que este app não conhece); campo solto torto é CORRIGIDO — a mesma régua de dois pesos
 * da importação de ficha (`validarSheetApplyPayload`), e pelo mesmo motivo: o arquivo vem de fora,
 * e um campo estragado não pode custar o personagem inteiro.
 *
 * Os presets saem daqui CRUS, só com o teto de quantidade: quem julga cada um é o
 * `isValidPresetInput` do processo principal, a mesma régua dos outros três caminhos que gravam
 * preset. Uma segunda régua aqui seria a que fica pra trás.
 */
export function lerPacote(bruto: unknown): PacoteDePersonagem {
  if (typeof bruto !== 'object' || bruto === null) {
    throw new Error('Este arquivo não é um personagem exportado pelo Reroll.')
  }
  const pacote = bruto as Record<string, unknown>
  if (pacote.formato !== FORMATO_DO_PACOTE) {
    throw new Error('Este arquivo não é um personagem exportado pelo Reroll.')
  }
  if (!Number.isInteger(pacote.versao) || (pacote.versao as number) < 1) {
    throw new Error('Este arquivo não é um personagem exportado pelo Reroll.')
  }
  if ((pacote.versao as number) > VERSAO_DO_PACOTE) {
    throw new Error('Este personagem foi exportado por uma versão mais nova do Reroll — atualize o app pra abri-lo.')
  }

  const personagem = (typeof pacote.personagem === 'object' && pacote.personagem !== null ? pacote.personagem : {}) as Record<string, unknown>
  const ficha = pacote.ficha
  if (typeof ficha !== 'object' || ficha === null) throw new Error('O arquivo está sem a ficha do personagem.')

  const presetsBrutos = Array.isArray(pacote.presets) ? pacote.presets : []
  if (presetsBrutos.length > MAXIMO_DE_PRESETS_POR_PERSONAGEM) {
    throw new Error(
      `O arquivo tem ${presetsBrutos.length} presets; um personagem guarda no máximo ${MAXIMO_DE_PRESETS_POR_PERSONAGEM}.`
    )
  }
  const presets: PresetDoPacote[] = presetsBrutos
    .filter((preset): preset is Record<string, unknown> => typeof preset === 'object' && preset !== null)
    .map((preset) => {
      const favorito = favoritoSaneado(preset.favorito)
      const { favorito: _fora, ...resto } = preset
      return (favorito === undefined ? resto : { ...resto, favorito }) as PresetDoPacote
    })

  return {
    formato: FORMATO_DO_PACOTE,
    versao: pacote.versao as number,
    app: typeof pacote.app === 'string' ? pacote.app.slice(0, 40) : '',
    exportadoEm: typeof pacote.exportadoEm === 'string' ? pacote.exportadoEm.slice(0, 40) : '',
    personagem: {
      name: rotulo(personagem.name),
      system: rotulo(personagem.system),
      photo: fotoDePerfilValida(personagem.photo)
    },
    ficha: normalizeNotes(ficha),
    presets,
    aparencia: sanearAparencia(pacote.aparencia)
  }
}

function rotulo(valor: unknown): string {
  return typeof valor === 'string' ? valor.slice(0, TAMANHO_MAXIMO_DO_NOME) : ''
}

/**
 * `Matias Oliveira - Reroll.html`. O que o Windows não aceita em nome de arquivo vira espaço, e um
 * personagem sem nome vira "Personagem" — o diálogo de salvar deixa trocar de qualquer jeito.
 */
export function nomeDoArquivoDoPacote(nome: string): string {
  const limpo = nome
    // Os reservados do Windows e os caracteres de controle (código abaixo de 32).
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/[\s\S]/g, (c) => (c.charCodeAt(0) < 32 ? ' ' : c))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${limpo || 'Personagem'} - Reroll.html`
}

/** O que o canal de importação devolve ao renderer: o perfil criado e a aparência pra ele gravar. */
export interface PacoteImportado {
  perfil: Profile
  aparencia: AparenciaDoPersonagem | null
}
