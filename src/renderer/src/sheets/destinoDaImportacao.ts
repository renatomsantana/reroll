import type { Profile } from '@shared/types/profile'
import { fichaEstaVazia } from '@shared/types/notes'

/**
 * Regras da importação de ficha, sem React pra testar com objeto na mão.
 *
 * Importar cria um personagem novo (regra dele, 02/09/2026: nunca gravar por cima de quem existe).
 * Exceção: o personagem aberto está em branco (sem nome e sem ficha, o recém-criado pelo "Novo
 * personagem"). Aí a ficha entra nele; criar outro deixava um sem nome pra trás e, com o teto de 3,
 * gastava dois lugares por importação.
 */

export interface DestinoDaImportacao {
  characterName: string
  /** Só quando o aberto está em branco; sem isso o main cria um personagem novo. */
  targetProfileId?: string
}

/** Nome do arquivo como nome do personagem, quando o leitor não achou nenhum. */
export function nomeDoArquivo(fileName: string): string {
  return fileName
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Sem nome e sem nada na ficha. Foto, diário e barras não contam: a importação não apaga nenhum
 * deles.
 */
export function personagemEmBranco(
  perfil: Pick<Profile, 'name'> | undefined,
  notes: Parameters<typeof fichaEstaVazia>[0]
): boolean {
  return !!perfil && !perfil.name.trim() && fichaEstaVazia(notes)
}

/** Nome do leitor ou, na falta, do arquivo; destino só quando o aberto está em branco. */
export function escolherDestino(entrada: {
  nomeLido: string
  fileName: string
  aberto?: { id: string; emBranco: boolean }
}): DestinoDaImportacao {
  const nome = entrada.nomeLido.trim()
  const characterName = nome || nomeDoArquivo(entrada.fileName)
  if (entrada.aberto?.emBranco) return { characterName, targetProfileId: entrada.aberto.id }
  return { characterName }
}
