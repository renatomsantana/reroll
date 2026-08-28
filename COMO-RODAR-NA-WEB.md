# Reroll na web (e no celular)

A versão web mora em `src/web/` e fica TOTALMENTE de lado do app Electron: o instalador não muda
um byte por causa dela. Quando chegar a hora de migrar, o grosso já está pronto.

## Comandos

```
npm run dev:web        # desenvolver com recarga (http://localhost:5173)
npm run build:web      # gera o site estático em out/web/
npm run preview:web    # serve o out/web/ pra conferir o build
npx electron scripts/olharVersaoWeb.mjs   # fotografa o build em janela oculta (desktop + celular)
```

Pra publicar: `out/web/` é um site estático completo — qualquer hospedagem serve (GitHub Pages,
Netlify, um Apache). Só precisa ser **https** (ou localhost): o `crypto.randomUUID` e a área de
transferência exigem contexto seguro.

## Como funciona (a decisão importante)

A versão web NÃO reimplementa a lógica do app. Ela roda os módulos do processo principal
(repositórios, handlers, validação, backups §8.1/§9.1) no navegador, trocando só as portas de
plataforma por shims (`src/web/shims/`):

| No desktop                     | Na web                                        |
| ------------------------------ | --------------------------------------------- |
| disco (`userData`)             | IndexedDB (banco `reroll-web`)                |
| diálogo nativo de abrir        | seletor de arquivo do navegador               |
| diálogo de "salvar como"       | download com o nome sugerido                  |
| `ipcMain`/preload              | chamada direta (`src/web/api.ts`)             |
| auto-updater                   | nada — a página servida é sempre a atual      |
| botões de janela               | escondidos (`src/web/web.css`)                |

Zero deriva por construção: a regra que vale no app instalado vale na web, porque é o MESMO
código. O teste `src/web/ponteWeb.node.test.ts` prova o caminho inteiro (importar ficha, trocar
de personagem, apagado indo pro backup, exportar/importar pacote e presets, PDF).

O teste-guardião `src/web/fronteiraDoRenderer.node.test.ts` é o que mantém isso possível: ele
falha se qualquer arquivo do renderer importar `electron` ou módulo do Node. A fronteira furada é
o único jeito de a versão web quebrar sem ninguém notar.

## O que muda pra quem usa

- Os dados vivem NO NAVEGADOR (IndexedDB daquele site, naquele computador). Limpar os dados do
  site apaga os personagens — exportar o pacote `.html` de vez em quando continua sendo o backup
  de verdade entre máquinas.
- Salvar arquivo vira download; abrir arquivo vira o seletor do navegador.
- Não há janelinha compacta flutuando sobre outros programas (o modo compacto muda só o layout).
- Instalável no celular: "Adicionar à tela inicial" (tem manifest). Ainda não funciona offline
  (não há service worker — fica pra passada mobile).

## O que falta pra chamar de lançado

1. **Layout de celular**: o app ABRE e roda no celular (ver `out/olhar-web/celular.png`), mas em
   tela estreita o bloco do personagem sobrepõe os controles de rolagem — precisa da passada de
   layout pra toque/tela pequena.
2. **Service worker** se quiser offline / PWA completo.
3. Decidir hospedagem e testar num celular de verdade (toque, desempenho da cena 3D).
