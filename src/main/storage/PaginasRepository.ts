import { promises as fs } from 'fs'
import { join } from 'path'
import { MAXIMO_DE_PAGINAS_GUARDADAS, paginasValidas } from '@shared/types/paginasDaFicha'
import type { ProfilesRepository } from './ProfilesRepository'

/**
 * As PÁGINAS DO PDF do personagem, como arquivos na pasta dele: `pagina-01.jpg`, `pagina-02.jpg`...
 * (ver `paginasDaFicha.ts`).
 *
 * Arquivos, e não um campo do `notes.json`, porque o `notes.json` é lido inteiro e gravado a cada
 * tecla digitada na ficha: um megabyte e meio de base64 dentro dele faria cada tecla custar isso.
 * As páginas só mudam na importação; a Ficha as pede quando quer mostrar.
 *
 * Mesmo desenho de `NotesRepository`: o diretório é o do perfil ATIVO, e trocar de personagem não
 * move nada.
 */
export class PaginasRepository {
  constructor(private readonly profiles: ProfilesRepository) {}

  /** Grava as páginas NO LUGAR das que havia. Lista vazia apaga. Data URL torto é pulado. */
  async gravar(paginas: string[]): Promise<number> {
    const pasta = this.profiles.activeDirectory()
    await fs.mkdir(pasta, { recursive: true })
    await this.apagarArquivos(pasta)
    let gravadas = 0
    for (const pagina of paginasValidas(paginas)) {
      const decodificada = decodificar(pagina)
      if (!decodificada) continue
      gravadas++
      await fs.writeFile(join(pasta, nomeDoArquivo(gravadas, decodificada.extensao)), decodificada.bytes)
    }
    return gravadas
  }

  /** As páginas do personagem ativo, como data URLs, na ordem. Sem pasta ou sem página: lista vazia. */
  async ler(): Promise<string[]> {
    const pasta = this.profiles.activeDirectory()
    let nomes: string[]
    try {
      nomes = (await fs.readdir(pasta)).filter((n) => ARQUIVO_DE_PAGINA.test(n)).sort()
    } catch {
      return []
    }
    const paginas: string[] = []
    for (const nome of nomes.slice(0, MAXIMO_DE_PAGINAS_GUARDADAS)) {
      const bytes = await fs.readFile(join(pasta, nome))
      const extensao = nome.slice(nome.lastIndexOf('.') + 1)
      paginas.push(`data:image/${extensao === 'jpg' ? 'jpeg' : extensao};base64,${bytes.toString('base64')}`)
    }
    return paginas
  }

  private async apagarArquivos(pasta: string): Promise<void> {
    for (const nome of await fs.readdir(pasta)) {
      if (ARQUIVO_DE_PAGINA.test(nome)) await fs.rm(join(pasta, nome), { force: true })
    }
  }
}

const ARQUIVO_DE_PAGINA = /^pagina-\d{2}\.(jpg|png|webp)$/

function nomeDoArquivo(numero: number, extensao: string): string {
  return `pagina-${String(numero).padStart(2, '0')}.${extensao}`
}

function decodificar(dataUrl: string): { bytes: Buffer; extensao: string } | null {
  const casou = /^data:image\/(jpeg|png|webp);base64,(.+)$/s.exec(dataUrl)
  if (!casou) return null
  return { bytes: Buffer.from(casou[2], 'base64'), extensao: casou[1] === 'jpeg' ? 'jpg' : casou[1] }
}
