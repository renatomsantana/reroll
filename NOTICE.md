# Créditos e licenças de terceiros

O código do Reroll é MIT (ver `LICENSE`). O que vem de fora tem licença própria, e está aqui.

## Fontes empacotadas

| Fonte | Licença | Onde |
| --- | --- | --- |
| Montserrat | SIL Open Font License 1.1 | `src/renderer/src/assets/fonts/` |
| JetBrains Mono | SIL Open Font License 1.1 | `src/renderer/src/assets/fonts/` |
| Lora | SIL Open Font License 1.1 | `src/renderer/src/assets/fonts/` |
| Parisienne | SIL Open Font License 1.1 | `src/renderer/src/assets/fonts/` |

As demais fontes do menu de Preferências **não** são empacotadas — o app usa a que já estiver
instalada no Windows e cai numa família genérica quando não estiver. Ver `FONT_OPTIONS` em
`settings/SettingsContext.tsx`, que explica caso a caso.

Três fontes do menu aparecem na lista e **não** são redistribuídas de propósito, todas pelo mesmo
motivo: são gratuitas apenas para uso pessoal, e empacotá-las num app publicado seria
redistribuição. Quem as tiver instaladas no Windows as vê; quem não tiver cai no reserva.

| Fonte | Autoria | Licença |
| --- | --- | --- |
| Janda Silly Monkey | Kimberly Geswein | gratuita só para uso pessoal |
| Sweetie | Graphix Line Studio | gratuita só para uso pessoal |
| Hello Honey | Ef Studio | gratuita só para uso pessoal |

As três vendem licença comercial à parte. Se um dia o Reroll precisar empacotá-las, é essa licença
que tem de ser comprada — não basta o arquivo estar disponível para download.

A **Algerian** está no menu pelo mesmo arranjo, mas por outro motivo: ela não é gratuita para uso
nenhum. É comercial (Letraset/URW), e chega à maioria das máquinas por vir junto do **Microsoft
Office** desde 1993 — não com o Windows. Quem não tiver Office vê o reserva (`Arial Black`). O
Reroll não redistribui nem poderia: empacotá-la exigiria comprar a licença da fonte.

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
