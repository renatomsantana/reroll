import { join, sep } from 'path'

/**
 * Onde moram os arquivos do ícone do app, em duas formas que servem a coisas diferentes:
 *
 * - `.png` → `nativeImage` da janela (`BrowserWindow({ icon })` e `window.setIcon`), que manda no
 *   ícone do título e do Alt+Tab.
 * - `.ico` → campo de ícone dos ATALHOS (`.lnk`), que é o que a barra de tarefas mostra enquanto o
 *   app declarar um AppUserModelID (ver `shortcutIcon.ts`). Atalho do Windows não aceita PNG.
 */

/**
 * O `replace` é o ponto que não é óbvio: empacotado, `__dirname` fica dentro de `app.asar`, e os
 * dois arquivos são abertos pelo lado NATIVO (Electron pro `.png`, Windows pro `.ico`), que não sabe
 * ler de dentro do asar. `electron-builder.yml` deixa `build/icons/**` desempacotado em
 * `app.asar.unpacked` justamente por isso, e aqui o caminho é redirecionado pra lá.
 *
 * Em desenvolvimento não existe `app.asar` no caminho, então o `replace` não troca nada.
 */
function resolveUnpackedIcon(fileName: string): string {
  return join(__dirname, '../../build/icons', fileName).replace(
    `app.asar${sep}`,
    `app.asar.unpacked${sep}`
  )
}

/** PNG do ícone da janela. Quem chama deve ter validado `iconId` com `isValidAppIconId`. */
export function resolveAppIconPath(iconId: string): string {
  return resolveUnpackedIcon(`${iconId}.png`)
}

/** `.ico` do mesmo ícone, gerado por `scripts/generate-icon.mjs`, pro atalho do Windows. */
export function resolveAppIconIcoPath(iconId: string): string {
  return resolveUnpackedIcon(`${iconId}.ico`)
}
