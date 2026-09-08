import { normalizeProfiles, type ProfilesState } from '@shared/types/profile'

/**
 * A ORDEM de trocar de personagem: grava primeiro, muda a tela depois.
 *
 * É o contrário da intuição, e o motivo é onde os dados moram. Anotações e presets são lidos da pasta
 * do perfil ATIVO, e quem sabe qual é o ativo é o processo principal: se a tela trocar antes de a
 * gravação chegar lá, os efeitos de `useNotes`/`usePresets` pedem os dados do personagem NOVO enquanto
 * o principal ainda aponta pro ANTIGO — volta a ficha errada, e a primeira tecla grava ela por cima da
 * certa. Vale pras três operações que mexem em quem está aberto: trocar, criar e apagar.
 *
 * Mora fora do React de propósito: a regra é de SEQUÊNCIA, e sequência é o tipo de coisa que passa
 * despercebida numa leitura e some num refactor. Dentro de um `useCallback` não havia como prová-la.
 */

export interface ResultadoDaTroca {
  /** O estado que deve valer na tela agora. */
  estado: ProfilesState
  /** `false` quando a gravação falhou e a troca foi desfeita. */
  trocou: boolean
  erro?: unknown
}

export async function trocarPerfil(
  anterior: ProfilesState,
  mudanca: (previous: ProfilesState) => ProfilesState,
  salvar: (estado: ProfilesState) => Promise<unknown>
): Promise<ResultadoDaTroca> {
  const proximo = normalizeProfiles(mudanca(anterior))

  try {
    await salvar(proximo)
  } catch (erro) {
    /**
     * GRAVAÇÃO FALHOU: a tela NÃO troca. Este era o furo — a versão anterior avisava no console e trocava
     * assim mesmo, o que reabre exatamente a corrida que a função existe pra fechar, só que por erro em
     * vez de por tempo: a tela passa a mostrar o personagem B enquanto o principal ainda lê a pasta do A.
     * Ficar no antigo é a resposta honesta, porque nada foi gravado e nada mudou.
     */
    return { estado: anterior, trocou: false, erro }
  }

  return { estado: proximo, trocou: true }
}
