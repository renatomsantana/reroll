import type { CapacitorConfig } from '@capacitor/cli'

/**
 * O REROLL COMO APP DE ANDROID.
 *
 * O Capacitor embrulha a MESMA versão web (`src/web/`, ver `COMO-RODAR-NA-WEB.md`) num app nativo:
 * os arquivos de `out/web/` viajam DENTRO do apk, e o WebView os abre de um endereço local. Não há
 * segunda implementação de nada — vale a mesma regra da web, que é rodar os módulos do processo
 * principal sobre shims.
 *
 * Foi escolhido no lugar de um TWA (o atalho que embrulha um site publicado) por dois motivos que
 * pesam mais que a simplicidade dele: o TWA exige o site NO AR e uma hospedagem pra manter, e ele
 * só funciona offline se houver service worker. Com o Capacitor, o app abre no avião.
 *
 *     npm run build:web && npx cap sync android
 *
 * O resto — assinar e subir — está em `COMO-PUBLICAR-NA-PLAY-STORE.txt`.
 */
const config: CapacitorConfig = {
  /*
   * O ID muda de família porque é ISSO que a Play Store enxerga: o `appId` é a identidade do app na
   * loja e no aparelho, é IMUTÁVEL depois da primeira publicação, e um `com.renato.reroll` igualzinho
   * ao `appId` do Electron confundiria as duas coisas na hora de olhar um erro. Aqui o sufixo diz
   * qual é qual.
   */
  appId: 'com.renato.reroll.android',
  appName: 'Reroll',

  /*
   * A pasta que o `vite.web.config.ts` escreve. O `cap sync` COPIA daqui pra dentro do projeto
   * Android — então `npm run build:web` antes de sincronizar, sempre, ou sobe a build anterior.
   */
  webDir: 'out/web',

  android: {
    /*
     * O WebView do sistema, e não o Chrome Custom Tab: é o que faz a cena 3D rodar com WebGL dentro
     * do app. `allowMixedContent` fica FALSO (o padrão) porque tudo é local; não há http nenhum.
     */
    backgroundColor: '#c0c0c0'
  },

  /*
   * A tela cinza do 98 por trás do WebView enquanto ele monta. Sem isto o Android pisca BRANCO entre
   * o ícone e o app, e branco é a única cor que esta interface não tem em lugar nenhum.
   */
  backgroundColor: '#c0c0c0'
}

export default config
