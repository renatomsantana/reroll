import { promises as fs } from 'fs'
import { dirname } from 'path'

/**
 * Leitura/escrita de um arquivo JSON genérico, com escrita atômica
 * (grava em .tmp e renomeia) para não corromper o arquivo se o processo
 * for fechado no meio de uma gravação.
 */
export class JsonFileStore<T> {
  /**
   * Fila que serializa gravações concorrentes — BUG REAL corrigido aqui: `write()` sem isso
   * deixava duas chamadas simultâneas (ex.: `NotesRepository.save` disparado a cada tecla
   * digitada, sem debounce, ver `useNotes.ts`) escreverem no MESMO caminho `.tmp` ao mesmo
   * tempo. Como as duas são assíncronas, a ordem de CONCLUSÃO não é garantida ser a mesma ordem
   * de CHAMADA — a gravação mais RECENTE podia terminar (escrever `.tmp` + renomear) antes da
   * mais ANTIGA, que then sobrescrevia o arquivo final com conteúdo mais velho por cima,
   * perdendo as últimas teclas digitadas silenciosamente (só visível ao reabrir o app). Encadear
   * cada `write()` atrás do anterior garante que elas rodem estritamente na ordem em que foram
   * chamadas, uma de cada vez — a última chamada sempre é a última a terminar.
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
