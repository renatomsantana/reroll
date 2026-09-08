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

/**
 * O nome que o LEITOR decidiu, e só ele; destino só quando o aberto está em branco.
 *
 * Aqui havia uma segunda régua — "nunca um personagem sem nome" —, que punha o nome do ARQUIVO no
 * lugar do vazio e desfazia calada a decisão do leitor. O leitor já sabe quando o nome do arquivo
 * serve de palpite ("Elias - ficha.pdf") e quando não serve: no modelo em branco baixado do site o
 * nome do arquivo é o TÍTULO da ficha, e nasciam personagens chamados "Ordem Paranormal - Ficha de
 * Personagem Editável" e "RemasterPlayerCoreCharacterSheet" (ver `nomeDeArquivoComoPalpite`).
 *
 * Personagem sem nome não é problema: a lista o mostra como "Personagem N" pela posição, e a Ficha
 * abre com o cursor no campo do nome.
 */
export function escolherDestino(entrada: {
  nomeLido: string
  fileName: string
  aberto?: { id: string; emBranco: boolean }
}): DestinoDaImportacao {
  const characterName = entrada.nomeLido.trim()
  if (entrada.aberto?.emBranco) return { characterName, targetProfileId: entrada.aberto.id }
  return { characterName }
}
