import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import { app, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import { MAX_PROFILES, type Profile } from '@shared/types/profile'
import type { Language } from '@shared/types/idioma'
import { sanearAparencia, type AparenciaDoPersonagem } from '@shared/types/aparencia'
import {
  TAMANHO_MAXIMO_DO_PACOTE,
  extrairPacoteDoTexto,
  lerPacote,
  mesmoNome,
  montarPacote,
  nomeDoArquivoDoPacote,
  type PacoteDePersonagem,
  type PacoteImportado
} from '@shared/pacote/pacoteDePersonagem'
import { htmlDoPacote } from '@shared/pacote/htmlDoPacote'
import { isValidPresetInput } from './registerPresetsHandlers'
import { escolherArquivo, escolherOndeSalvar } from './dialogos'
import type { ProfilesRepository } from '../storage/ProfilesRepository'
import type { NotesRepository } from '../storage/NotesRepository'
import type { PresetsRepository } from '../storage/PresetsRepository'

/**
 * EXPORTAR e IMPORTAR o personagem inteiro: ver o cabeçalho de `pacoteDePersonagem.ts`.
 *
 * Os dois moram no processo principal pelo mesmo motivo da importação de ficha: é aqui que estão o
 * disco e os diálogos, e importar cria três coisas em ordem (perfil, ficha, presets) que precisam
 * acontecer atrás de um `await` só, sem a interface no meio (ver `registerSheetHandlers`).
 *
 * A APARÊNCIA é a exceção que atravessa nos dois sentidos: ela mora no `localStorage` do renderer,
 * que o principal não alcança. Na exportação o renderer manda a dele junto do pedido; na
 * importação o principal devolve a do arquivo, e o renderer grava antes de trocar de personagem.
 */

/** Só a estrutura: os dados vêm dos repositórios. Separado do handler pra ser testado com disco de verdade. */
export async function montarArquivoDoPacote(
  repos: { profiles: ProfilesRepository; notes: NotesRepository; presets: PresetsRepository },
  aparencia: AparenciaDoPersonagem | null,
  idioma: Language,
  versaoDoApp: string
): Promise<{ pacote: PacoteDePersonagem; html: string }> {
  const estado = await repos.profiles.get()
  const perfil = estado.profiles.find((p) => p.id === estado.activeId) ?? estado.profiles[0]
  const pacote = montarPacote({
    perfil,
    ficha: await repos.notes.get(),
    presets: await repos.presets.getAll(),
    aparencia,
    versaoDoApp,
    agora: new Date()
  })
  return { pacote, html: htmlDoPacote(pacote, idioma) }
}

/** A leitura sem o diálogo: teto ANTES de ler (o ponto do teto é não trazer os bytes pra memória), depois o pacote. */
export async function lerPacoteDoArquivo(caminho: string): Promise<PacoteDePersonagem> {
  const info = await fs.stat(caminho)
  if (!info.isFile()) throw new Error('O caminho escolhido não é um arquivo.')
  if (info.size > TAMANHO_MAXIMO_DO_PACOTE) {
    const mb = Math.round(TAMANHO_MAXIMO_DO_PACOTE / (1024 * 1024))
    throw new Error(`Arquivo grande demais para ser um personagem exportado (o limite é ${mb} MB).`)
  }
  const texto = await fs.readFile(caminho, 'utf-8')
  return lerPacote(extrairPacoteDoTexto(texto))
}

/**
 * O personagem do pacote entra na lista — ATUALIZANDO o que já existe com o mesmo nome, ou criando
 * um novo quando não há.
 *
 * A primeira versão criava sempre um novo, e o usuário mandou trocar: "não precisa criar outro,
 * quero que sempre esteja no limite de 3 personagens para todos os testadores". Faz sentido pelo
 * uso: quem exporta o Matias hoje e importa amanhã quer O Matias com o que veio no arquivo, não
 * dois Matias e o teto estourado. O arquivo é a palavra final — é o mesmo desenho da reimportação
 * de ficha em PDF (`targetProfileId`), só que casando pelo NOME, porque o arquivo não conhece o id
 * da outra máquina.
 *
 * Quando ATUALIZA, a ficha e os presets do personagem são SUBSTITUÍDOS pelos do arquivo: inclusive
 * o diário. Acrescentar deixaria duas fichas coladas; o pacote é o retrato inteiro do personagem,
 * então o que vale é ele.
 *
 * Tudo ou nada, como a importação de ficha: a lista, a ficha e os presets de antes são guardados e,
 * se qualquer gravação falhar, os três voltam e o erro sobe.
 */
export async function importarPacote(
  repos: { profiles: ProfilesRepository; notes: NotesRepository; presets: PresetsRepository },
  pacote: PacoteDePersonagem
): Promise<PacoteImportado> {
  const estado = await repos.profiles.get()
  const nome = pacote.personagem.name.trim() || pacote.ficha.characterName.trim()
  const existente = estado.profiles.find((p) => mesmoNome(p.name, nome))

  if (!existente && estado.profiles.length >= MAX_PROFILES) {
    throw new Error(
      `Limite de ${MAX_PROFILES} personagens atingido: o arquivo é de "${nome || 'sem nome'}", que não está na lista. Apague um personagem antes de importar.`
    )
  }

  const perfil: Profile = existente
    ? { ...existente, name: nome, system: pacote.personagem.system.trim(), photo: pacote.personagem.photo ?? existente.photo }
    : { id: randomUUID(), name: nome, system: pacote.personagem.system.trim(), photo: pacote.personagem.photo, createdAt: Date.now() }
  const lista = existente ? estado.profiles.map((p) => (p.id === perfil.id ? perfil : p)) : [...estado.profiles, perfil]
  await repos.profiles.save({ profiles: lista, activeId: perfil.id })

  // O que havia na pasta do personagem, pra voltar se a gravação falhar no meio. Num personagem novo
  // a pasta está vazia e isto é o padrão: barato de guardar, e o desfazer fica igual nos dois casos.
  const fichaAntes = await repos.notes.get()
  const presetsAntes = await repos.presets.getAll()
  try {
    await repos.notes.save({ ...pacote.ficha, characterName: perfil.name || pacote.ficha.characterName })
    const validos = pacote.presets.filter((preset) => {
      const ok = isValidPresetInput(preset)
      if (!ok) console.warn('Preset do pacote recusado pela validação; importando o resto:', preset)
      return ok
    })
    await repos.presets.substituirPeloPacote(validos)
  } catch (causa) {
    try {
      await repos.notes.save(fichaAntes)
      await repos.presets.substituirPeloPacote(presetsAntes)
    } finally {
      await repos.profiles.save(estado)
    }
    throw causa
  }

  return { perfil, aparencia: pacote.aparencia, substituiu: existente !== undefined }
}

export function registerPacoteHandlers(
  profiles: ProfilesRepository,
  notes: NotesRepository,
  presets: PresetsRepository
): void {
  const repos = { profiles, notes, presets }

  ipcMain.handle(IpcChannels.pacoteExportar, async (_event, bruto: unknown): Promise<string | null> => {
    const pedido = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
    const idioma: Language = pedido.idioma === 'en-US' ? 'en-US' : 'pt-BR'
    const { pacote, html } = await montarArquivoDoPacote(repos, sanearAparencia(pedido.aparencia), idioma, app.getVersion())

    // Pela porta de `dialogos.ts`, que é quem lembra a pasta: ver o cabeçalho de lá.
    const caminho = await escolherOndeSalvar({
      proposito: 'pacote',
      titulo: 'Exportar personagem',
      nomeSugerido: nomeDoArquivoDoPacote(pacote.personagem.name || pacote.ficha.characterName),
      filtros: [{ name: 'Personagem do Reroll', extensions: ['html'] }]
    })
    if (!caminho) return null

    await fs.writeFile(caminho, html, 'utf-8')
    return caminho
  })

  ipcMain.handle(IpcChannels.pacoteImportar, async (): Promise<PacoteImportado | null> => {
    const caminho = await escolherArquivo({
      proposito: 'pacote',
      titulo: 'Importar personagem Reroll',
      filtros: [
        { name: 'Personagem do Reroll', extensions: ['html', 'json'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    })
    if (!caminho) return null
    return importarPacote(repos, await lerPacoteDoArquivo(caminho))
  })
}
