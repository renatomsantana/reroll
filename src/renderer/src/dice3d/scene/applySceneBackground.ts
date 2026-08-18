import * as THREE from 'three'

/**
 * Aplica o fundo da cena — cor sólida (padrão) ou uma imagem escolhida pelo usuário (ver
 * `registerSceneBackgroundHandlers.ts`, StyleTab "Imagem de fundo"). Compartilhado entre
 * `createTrayScene`/`createTowerScene` (mesmo comportamento nos dois modos). Descarta a
 * textura anterior antes de trocar — evita vazar o recurso de GPU cada vez que o usuário troca
 * de imagem (mesma disciplina de `disposeMesh`/`disposeScene` já seguida no resto do projeto).
 *
 * Carregamento é assíncrono (`TextureLoader`) — a cena aparece com a cor sólida por uma fração
 * de segundo até a imagem terminar de carregar, um trade-off aceitável (mesma cor que já seria
 * o fundo sem imagem nenhuma, nunca uma tela preta/quebrada) em troca de não bloquear a
 * montagem da cena esperando o `<img>` carregar.
 */
export function applySceneBackground(
  scene: THREE.Scene,
  backgroundColor: number,
  backgroundImage: string | null
): void {
  const previousTexture = scene.background instanceof THREE.Texture ? scene.background : null

  if (!backgroundImage) {
    scene.background = new THREE.Color(backgroundColor)
    previousTexture?.dispose()
    return
  }

  new THREE.TextureLoader().load(
    backgroundImage,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      scene.background = texture
      previousTexture?.dispose()
    },
    undefined,
    () => {
      // Falha ao carregar (arquivo corrompido/removido depois de escolhido) — cai pra cor
      // sólida em vez de deixar o fundo quebrado/preto silenciosamente.
      scene.background = new THREE.Color(backgroundColor)
    }
  )
}
