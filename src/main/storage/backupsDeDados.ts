import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * OS BACKUPS DA PASTA DE DADOS (spec §8.1 e §9.1): "data loss on update is the single most
 * trust-destroying bug possible for an app whose promise is 'everything is saved'".
 *
 * Dois momentos em que o app copia antes de mexer:
 *
 * 1. NA PRIMEIRA ABERTURA DE UMA VERSÃO NOVA (`fazerBackupSeMudouDeVersao`): antes de ler qualquer
 *    coisa, a pasta inteira de dados (perfis, fichas, presets, preferências) vai pra
 *    `backups/pre-<versão>-<data>/`. O app não tem migração com número de esquema (ver
 *    `normalizeNotes`: o formato é corrigido na leitura), mas TEM formato mudando a cada beta, e a
 *    leitura corrigida grava por cima do arquivo na primeira tecla. Se uma versão ler errado, o
 *    arquivo de antes dela ainda existe. Ficam os três últimos, como a spec pede.
 *
 * 2. AO APAGAR UM PERSONAGEM (`guardarPersonagemApagado`): a pasta dele vai pra
 *    `backups/personagens-apagados/<id>-<data>/` em vez de continuar órfã em `profiles/` — que
 *    era o que acontecia, e que ninguém achava. A spec pede "removes all of its state (with
 *    confirmation + backup)"; a pasta some de onde o app lê e fica onde a pessoa pode recuperar.
 *
 * Nada aqui pode derrubar o arranque: quem chama trata a falha como aviso no console e segue. Um
 * backup que não deu certo é pior que nenhum só se impedir o app de abrir.
 */
export const BACKUPS_DE_VERSAO_A_MANTER = 3

/** O que vale a pena copiar de `userData`. O resto (cache do Chromium, logs) é pesado e regenerável. */
const ENTRADAS_DE_DADOS = ['profiles.json', 'settings.json', 'dialogos.json', 'notes.json', 'presets.json', 'profiles']

const ARQUIVO_DA_VERSAO = 'versao.json'

/** `20260826-004212`: ordena por texto na mesma ordem do tempo, e serve de nome de pasta. */
export function carimboDeData(agora = new Date()): string {
  const p = (n: number, largura = 2): string => String(n).padStart(largura, '0')
  return `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await fs.access(caminho)
    return true
  } catch {
    return false
  }
}

async function versaoGravada(userData: string): Promise<string | null> {
  try {
    const bruto = JSON.parse(await fs.readFile(join(userData, ARQUIVO_DA_VERSAO), 'utf-8')) as { versao?: unknown }
    return typeof bruto.versao === 'string' ? bruto.versao : null
  } catch {
    return null
  }
}

async function gravarVersao(userData: string, versao: string): Promise<void> {
  const destino = join(userData, ARQUIVO_DA_VERSAO)
  await fs.mkdir(userData, { recursive: true })
  await fs.writeFile(`${destino}.tmp`, JSON.stringify({ versao }, null, 2), 'utf-8')
  await fs.rename(`${destino}.tmp`, destino)
}

/**
 * Copia os dados pra `backups/pre-<versão>-<data>/` quando esta é a primeira abertura desta versão.
 * Devolve a pasta criada, ou `null` quando não havia o que fazer (mesma versão, ou instalação nova
 * sem dado nenhum). Os backups de versão mais antigos que os três últimos são apagados.
 */
export async function fazerBackupSeMudouDeVersao(userData: string, versao: string, agora = new Date()): Promise<string | null> {
  const anterior = await versaoGravada(userData)
  if (anterior === versao) return null

  const temDados = (await Promise.all(ENTRADAS_DE_DADOS.map((e) => existe(join(userData, e))))).some(Boolean)
  if (!temDados) {
    await gravarVersao(userData, versao)
    return null
  }

  const pastaDeBackups = join(userData, 'backups')
  const destino = join(pastaDeBackups, `pre-${versao}-${carimboDeData(agora)}`)
  await fs.mkdir(destino, { recursive: true })
  for (const entrada of ENTRADAS_DE_DADOS) {
    const origem = join(userData, entrada)
    if (!(await existe(origem))) continue
    await fs.cp(origem, join(destino, entrada), { recursive: true })
  }
  await fs.writeFile(
    join(destino, 'LEIA-ME.txt'),
    `Cópia da pasta de dados do Reroll feita antes de abrir a versão ${versao} pela primeira vez` +
      `${anterior ? ` (a versão anterior era ${anterior})` : ''}.\n` +
      'Pra voltar: feche o Reroll e copie estes arquivos de volta pra pasta de cima.\n',
    'utf-8'
  )

  await apagarBackupsDeVersaoAntigos(pastaDeBackups)
  await gravarVersao(userData, versao)
  return destino
}

async function apagarBackupsDeVersaoAntigos(pastaDeBackups: string): Promise<void> {
  const entradas = await fs.readdir(pastaDeBackups, { withFileTypes: true })
  const deVersao = entradas
    .filter((e) => e.isDirectory() && e.name.startsWith('pre-'))
    .map((e) => e.name)
    // O carimbo fica no FIM do nome; a versão no meio pode ter tamanhos diferentes, então a ordem é
    // pelo carimbo, e não pelo nome inteiro.
    .sort((a, b) => a.slice(-15).localeCompare(b.slice(-15)))
  for (const nome of deVersao.slice(0, Math.max(0, deVersao.length - BACKUPS_DE_VERSAO_A_MANTER))) {
    await fs.rm(join(pastaDeBackups, nome), { recursive: true, force: true })
  }
}

/**
 * Move a pasta de um personagem apagado pra `backups/personagens-apagados/`. Devolve o destino, ou
 * `null` se o personagem nunca chegou a ter pasta (criado e apagado sem escrever nada).
 */
export async function guardarPersonagemApagado(userData: string, idDePasta: string, agora = new Date()): Promise<string | null> {
  const origem = join(userData, 'profiles', idDePasta)
  if (!(await existe(origem))) return null
  const destino = join(userData, 'backups', 'personagens-apagados', `${idDePasta}-${carimboDeData(agora)}`)
  await fs.mkdir(join(userData, 'backups', 'personagens-apagados'), { recursive: true })
  await fs.rename(origem, destino)
  return destino
}
