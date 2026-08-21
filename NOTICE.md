# Créditos e licenças de terceiros

O código do Reroll é MIT (ver `LICENSE`). O que vem de fora tem licença própria, e está aqui.

## Fontes empacotadas

| Fonte | Licença | Onde |
| --- | --- | --- |
| Montserrat | SIL Open Font License 1.1 | `src/renderer/src/assets/fonts/` |
| JetBrains Mono | SIL Open Font License 1.1 | `src/renderer/src/assets/fonts/` |
| Lora | SIL Open Font License 1.1 | `src/renderer/src/assets/fonts/` |

As demais fontes do menu de Preferências **não** são empacotadas — o app usa a que já estiver
instalada no Windows e cai numa família genérica quando não estiver. Ver `FONT_OPTIONS` em
`settings/SettingsContext.tsx`, que explica caso a caso.

A **Janda Silly Monkey** aparece na lista e não é redistribuída de propósito: ela é gratuita apenas
para uso pessoal, e empacotá-la num app publicado seria redistribuição.

## Arte

Os ícones do app e as artes dos dados são de autoria própria ou contribuídas para este projeto. Os
créditos individuais estão ao lado de cada opção dentro do app (ver o campo `credit` em
`FONT_OPTIONS` e a tela de Preferências).

A textura do cavalo de Troia **não** está no repositório — é imagem de terceiro, e o
`.gitignore` explica por quê. Quem clonar o projeto vê o modelo sem ela.

## Fichas de RPG

As fichas usadas para desenvolver e testar o importador são material das editoras (Jambô, Wizards of
the Coast e outras) e **não** estão versionadas. Ler um PDF para extrair dados é uma coisa;
republicar o PDF é outra.

## Dependências

As bibliotecas usadas estão em `package.json`. As principais: Electron (MIT), React (MIT),
three.js (MIT), Rapier (Apache-2.0), pdf.js (Apache-2.0), electron-updater (MIT).
