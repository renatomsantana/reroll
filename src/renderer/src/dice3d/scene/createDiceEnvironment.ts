import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface DiceEnvironment {
  /** Libera a textura de ambiente da GPU — chamar no cleanup da cena. */
  dispose: () => void
}

/**
 * Ambiente de reflexo neutro (não é um skybox visível — só serve de fonte de reflexo pra
 * PBR) necessário pra `metalness` alto (ver opção "metálico" das Preferências) não ficar
 * preto/sem vida. Sem `scene.environment`, um material metálico não tem NADA pra refletir e
 * sai quase preto sob as luzes diretas simples desta cena — isso é como reflexão física
 * (PBR) funciona, não um bug de configuração de luz. `RoomEnvironment` é um ambiente
 * genérico neutro do próprio three.js (não uma imagem/HDRI externa), gerado uma vez e
 * reaproveitado — barato o bastante pra manter ligado sempre, não só quando algum dado é
 * metálico (melhora sutilmente o material padrão também).
 */
export function setupDiceEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): DiceEnvironment {
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTexture
  pmremGenerator.dispose()

  return {
    dispose: () => {
      scene.environment = null
      envTexture.dispose()
    }
  }
}
