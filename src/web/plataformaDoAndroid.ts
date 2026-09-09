/**
 * A `PlataformaDeArquivos` do APP DE ANDROID — a mesma da web, menos o download.
 *
 * O motivo de este arquivo existir é um defeito silencioso: no WebView do Android, um `<a download>`
 * apontando pra `blob:` NÃO FAZ NADA. Sem clique de erro, sem mensagem, sem arquivo. E o que passa
 * por esse caminho aqui é justamente o backup — o pacote `.html` do personagem, os presets, o PDF da
 * ficha —, ou seja, o app diria "exportado" e não teria exportado coisa nenhuma.
 *
 * O que substitui: gravar no cache do app e abrir a FOLHA DE COMPARTILHAMENTO do Android, que é o
 * gesto nativo pra "manda isso pra algum lugar" — Drive, WhatsApp, Arquivos, o que a pessoa tiver.
 * Não é escrever direto na pasta Downloads de propósito: a partir do Android 10 isso exige permissão
 * de armazenamento, e pedir permissão pra salvar um arquivo que a pessoa mesma pediu é o tipo de
 * caixa que faz desinstalar o app.
 *
 * ABRIR arquivo continua sendo o `<input type="file">` da web: o Capacitor trata o seletor de
 * arquivo do WebView sozinho (`onShowFileChooser`), e o gesto é o mesmo.
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { PlataformaDeArquivos } from './shims/electron'
import { plataformaDoNavegador } from './seletorDeArquivos'

/** Estamos rodando dentro do app de Android (ou de iOS um dia), e não numa aba de navegador? */
export function ehAppNativo(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Bytes em base64, que é o formato que o `Filesystem` aceita pra conteúdo binário.
 *
 * Em PEDAÇOS, e isto não é zelo: `String.fromCharCode(...bytes)` de uma vez estoura a pilha de
 * argumentos com arquivo grande, e o PDF de uma ficha preenchida passa fácil de um mega. 32 KB por
 * vez é folgado em qualquer motor.
 */
function paraBase64(bytes: Uint8Array): string {
  const PEDACO = 32 * 1024
  let texto = ''
  for (let i = 0; i < bytes.length; i += PEDACO) {
    texto += String.fromCharCode(...bytes.subarray(i, i + PEDACO))
  }
  return btoa(texto)
}

export const plataformaDoAndroid: PlataformaDeArquivos = {
  // Repassado numa seta, e não `abrirArquivo: plataformaDoNavegador.abrirArquivo`: o método
  // solto do objeto perde o `this` (o linter cobra), e um dia ele pode precisar dele.
  abrirArquivo: (opcoes) => plataformaDoNavegador.abrirArquivo(opcoes),

  baixarArquivo(nome, conteudo): void {
    void (async () => {
      /*
       * `Directory.Cache`: o Android limpa sozinho quando precisar de espaço, e é o certo pra um
       * arquivo que só existe pra ser entregue a outro app. O que a pessoa escolher guardar no Drive
       * ou nos Arquivos vira cópia dela, fora do nosso alcance — e é assim que tem que ser.
       */
      const gravado = await Filesystem.writeFile({
        path: nome,
        data: paraBase64(conteudo),
        directory: Directory.Cache
      })
      await Share.share({ title: nome, files: [gravado.uri] })
    })().catch((causa) => {
      // Uma falha aqui é a pessoa ter fechado a folha de compartilhamento, ou o disco cheio. Vale
      // como registro pro `adb logcat`, e nunca como diálogo por cima de quem está jogando.
      console.warn('não deu pra compartilhar o arquivo:', causa)
    })
  }
}
