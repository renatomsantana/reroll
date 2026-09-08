import { promises as fs } from 'fs'
import { dirname } from 'path'

/**
 * Leitura/escrita de um arquivo JSON genérico, com escrita atômica
 * (grava em .tmp e renomeia) para não corromper o arquivo se o processo
 * for fechado no meio de uma gravação.
 */
export class JsonFileStore<T> {
  /**
   * Fila que serializa gravações concorrentes, e ela conserta um bug real: sem isso, duas chamadas
   * simultâneas (o `NotesRepository.save` dispara a cada tecla digitada) escreviam no MESMO `.tmp` ao
   * mesmo tempo, e como a ordem de CONCLUSÃO não é a de CHAMADA, a gravação mais recente podia
   * terminar antes da mais antiga — que então sobrescrevia o arquivo final com conteúdo mais velho,
   * perdendo as últimas teclas em silêncio. Encadeando, a última chamada é sempre a última a terminar.
   */
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T
  ) {}

  async read(): Promise<T> {
    let raw: string
    try {
      raw = await fs.readFile(this.filePath, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.defaultValue
      }
      throw error
    }

    try {
      return JSON.parse(raw) as T
    } catch {
      // Arquivo existe mas o conteúdo está corrompido (gravação interrompida, edição manual
      // malformada, etc.) — cai no padrão em vez de propagar e travar quem chamou `read()`
      // (ver requisito do script.md: "Storage code must tolerate missing, outdated or
      // corrupted data and provide safe defaults").
      console.error(`Conteúdo inválido em ${this.filePath}, usando valor padrão.`)
      return this.defaultValue
    }
  }

  async write(data: T): Promise<void> {
    const run = this.writeQueue.then(() => this.writeNow(data))
    // Nunca deixa uma gravação que falhou travar a fila pra sempre (as próximas ainda devem
    // rodar) — mas a REJEIÇÃO em si precisa continuar propagando pra quem chamou este `write()`
    // específico saber que falhou (ver tratamento de erro em `useNotes.ts`/repositórios).
    this.writeQueue = run.catch(() => undefined)
    return run
  }

  private async writeNow(data: T): Promise<void> {
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    const tmpPath = `${this.filePath}.tmp`
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmpPath, this.filePath)
  }
}
