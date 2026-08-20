import { normalizeProfiles, type ProfilesState } from '@shared/types/profile'

/**
 * A ORDEM de trocar de personagem: grava primeiro, muda a tela depois.
 *
 * É o contrário da intuição, e o motivo é onde os dados moram. Anotações e presets são lidos da
 * pasta do perfil ATIVO, e quem sabe qual é o ativo é o processo principal
 * (`ProfilesRepository.activeDirectory`). Se a tela trocar antes de a gravação chegar lá, os efeitos
 * de `useNotes`/`usePresets` disparam na hora e pedem os dados do personagem NOVO enquanto o
 * principal ainda aponta pro ANTIGO — volta a ficha errada, e a primeira tecla digitada grava ela
 * por cima da certa.
 *
 * Vale pras três operações que mexem em quem está aberto: TROCAR, CRIAR e APAGAR.
 *
 * Isto mora fora do React de propósito. A regra é de SEQUÊNCIA, e sequência é o tipo de coisa que
 * passa despercebida numa leitura e some num refactor — dentro de um `useCallback` não havia como
 * prová-la. Aqui há.
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
     * GRAVAÇÃO FALHOU: a tela NÃO troca.
     *
     * Este era o furo. A versão anterior avisava no console e trocava assim mesmo — o que reabre
     * exatamente a corrida que a função existe pra fechar, só que por erro em vez de por tempo: a
     * tela passa a mostrar o personagem B enquanto o processo principal ainda lê a pasta do A, e a
     * primeira tecla digitada grava a ficha do B por cima da do A.
     *
     * Ficar no personagem antigo é a resposta honesta: nada foi gravado, então nada mudou.
     */
    return { estado: anterior, trocou: false, erro }
  }

  return { estado: proximo, trocou: true }
}
