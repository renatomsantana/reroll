# Histórico de versões

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões seguem
[SemVer](https://semver.org/lang/pt-BR/).

Cada versão publicada tem o SHA-256 do instalador na página da release — confira antes de instalar
(ver `CONTRIBUTING.md`).

## [Não lançado]

O HUD do personagem sobre a cena (spec §3.6), com as barras de recurso (§3.4) e o Descansar
(§3.8): pronto na `main`, instalado na máquina dele, guardado pra uma liberação própria — é o
`HUD_LIBERADO` em `src/shared/liberacoes.ts`, que o branch de lançamento vira pra `false`.

### Adicionado (o jeito do Oblívio, pra toda ficha)

- **Golpe escrito em prosa vira preset em QUALQUER ficha** — pedido dele: "esse jeito do Oblívio,
  vamos deixar pra TODAS as fichas". O que o leitor de Oblívio fazia só com as habilidades dele
  (habilidade cujo texto diz Teste/Dano com o dado na mesma frase vira preset com o nome do golpe)
  saiu do leitor e passou a rodar no `readSheet`, sobre os campos finais de qualquer leitor: o
  "Características" de D&D, o "Habilidades" de Ordem, o talento de Pathfinder, o campo sem sistema
  do genérico (`presetsDeProsa.ts`). O nome vem do "Nome:" que abre a frase ("Corte Cruel: Teste de
  Combate com 2D6+1"), ou do rótulo do campo; a âncora dentro do nome ("ataque furtivo: 1d6", na
  ficha do Go) ainda vale, com o tipo em aberto; "3d6 extra damage" é dano mesmo com "Attack" antes.
  O preset de "campo inteiro" que o genérico fazia de um parágrafo com dado (um botão "Habilidades"
  rolando o primeiro dado do texto) sai quando a prosa rendeu golpes com nome. Campo que o leitor
  dedicado já transformou em preset (o item de Oblívio com "Dano:") não ganha um segundo botão.
  Conferido nas fichas reais do corpus: nenhum preset novo de regra impressa.
- **Ficha de texto sem formulário: o que não virou campo vai pro texto da ficha** (só no genérico;
  o leitor dedicado conhece o modelo). Antes, o que não era "Rótulo: valor" era jogado fora — o
  Espaço Livre de Oblívio mostrou que é ali que o jogador escreve o que não coube em campo. Ficam de
  fora só o título da ficha e o rótulo impresso sem valor.
- **O Espaço Livre de Oblívio em linhas legíveis**: o Google Docs exporta o texto justificado uma
  palavra por fragmento ("Náusea", "ou", "Sem", "Fôlego."), e a ficha real chegava assim no bloco de
  história. Fragmentos da mesma linha do papel viram uma linha.

### Adicionado

- **Barras de recurso (§3.4)** — PV, PE, Sanidade (ou o que o sistema tiver) sempre à vista na tela
  de rolagem, no HUD sobre a cena (ver §3.6), com "−" e "+" ao lado de cada uma: clique tira ou soma 1,
  Shift+clique ou segurar o botão anda de 5 em 5, e clicar no número abre um campo que aceita
  conta (`-7`), valor exato (`12`) ou o par inteiro (`12/40`). A cor muda de bloco com o estado:
  verde, oliva abaixo da metade, bordô abaixo de um quarto — as três da paleta do Windows — ou uma
  cor fixa escolhida por barra. Cada clique GRAVA na hora no `notes.json` do personagem, então
  trocar de ficha e voltar, ou fechar o app no meio do combate, não perde o PV.

- **As barras no modo compacto também**: uma linha fina por barra entre o dado e os presets, e a
  janelinha CRESCE 19px por barra (medido numa janela oculta com zero, uma e três barras — o painel
  do dado fica com os mesmos 101px em todos os casos; `scripts/medirBarrasCompactas.mjs`).

- **Editor de barras** (o lápis no cabeçalho do HUD): nome, atual, máximo, cor, acrescentar e
  remover — até doze por personagem. Subir de nível é mexer no máximo ali, sem reimportar. Sem
  nenhuma barra, o HUD mostra a dica e o lápis é o caminho pra criar a primeira.

- **A importação de ficha PROPÕE as barras**: os pares "PV atual / PV máximo" que os leitores já
  traziam como campos soltos (Ordem, D&D, Pathfinder), o "12/40" num campo só (Oblívio, a Carga de
  Ordem) e o "Current HP / Max HP" em inglês viram barras na tela de conferência, cada uma com a
  própria caixa. Ficha com só o máximo preenchido (a do Matias) vira barra CHEIA, marcada como
  "atual em branco". Reimportar funde pelo nome: o PV com máximo novo é a MESMA barra, com a cor
  que a pessoa escolheu; barra criada à mão fica.

- **Descansar (§3.8)** — um botão na legenda das barras. Cada personagem tem os seus TIPOS de
  descanso (D&D: longo devolve tudo, curto vem vazio pra pessoa preencher; Ordem: descanso
  devolve tudo, intervalo só o PE; sistema desconhecido: um descanso que devolve tudo — a ficha
  importada já nasce com eles), e cada tipo diz, barra por barra: volta ao máximo, soma N, ou
  nada. O clique NUNCA é silencioso: abre a confirmação com o delta ("PV 12 → 45, PE 4 → 12"),
  com o tipo escolhível quando há mais de um, e um "Editar tipos…" ali mesmo. Confirmado, as
  barras mudam, gravam, e o histórico da sessão ganha a linha "— Descanso longo — PV 12→45" —
  o histórico passou a aceitar EVENTOS além de rolagens (`ItemDoHistorico`), em vez de fingir
  que um descanso é uma rolagem de total zero. Sem tipo configurado, o botão oferece um
  descanso completo sem gravar nada. Nada de timer, nada automático.

- **HUD do personagem sobre a cena (§3.6)** — um cartão de jogo flutuando num canto da cena 3D:
  retrato, nome, as MESMAS barras de recurso (com os mesmos "−"/"+"), as condições como chips
  que ligam e desligam com um clique ("Machucado", "Enlouquecendo" — sugeridas na importação de
  Ordem; qualquer outra pelo "+"), e o Descansar. Arrasta-se pelo cabeçalho e ENCAIXA no canto
  mais perto ao soltar; encolhe pra "mini" (retrato e barras finas, sem rótulo); esconde num
  clique e volta pelo retrato miúdo que fica no canto. Canto, mini e escondido são do personagem
  e gravam na hora. É DOM por cima do canvas — texto nítido, custo zero por quadro, o relevo do
  98 — e não existe no modo compacto, que já tem as barras finas.

### Corrigido

- **O HUD só explica o lápis, e nenhum texto do app usa travessão** — pedido dele: "ajeita esse
  HUD do rolador, apenas explique o que é o lápis, não usa nenhum travessão digitando no app". O
  HUD sem barras dizia "Nenhuma barra ainda — o lápis aí em cima cria PV, PE, Sanidade... (ou
  importe uma ficha)"; agora diz só o que o lápis faz ("O lápis ali em cima cria as barras de PV,
  PE, Sanidade e o que mais o seu sistema usar"), e o próprio lápis explica no `title`. E os 75
  textos da interface que usavam "—" pra emendar frase e explicação (avisos, dicas, mensagens de
  erro, a linha do descanso no histórico, que virou "[ Descanso ]") trocaram por dois pontos, ponto
  ou vírgula; as mensagens de erro do processo principal também. `traducoes.test.ts` passa a
  recusar travessão em qualquer texto dos dois idiomas.

## [1.1.2] — 2026-08-28

O que sai pra quem testa: o personagem inteiro num arquivo (exportar na Ficha, importar noutro
PC), a ficha de Oblívio lida por inteiro, copiar a rolagem pro chat, crítico e falha, favoritos,
a página do PDF ao lado dos campos na conferência, backup da pasta de dados a cada versão nova,
fontes novas e um monte de conserto. O teto continua em três personagens.

### Adicionado

- **A ficha de Oblívio inteira** — reporte de tester: "não scrapou os itens do inventário" e
  "golpes com teste não viraram preset". "Equipamentos Guardados" era só o marcador de fim dos
  carregados e tudo depois dele ia fora; agora é lido item por item (o "Mod:" cola no item de cima),
  entra no Inventário, e arma guardada com "Dano:" vira preset. Habilidade cujo texto diz o dado do
  teste ou do dano ("Teste de Combate com 2D6+1") vira preset com o nome do golpe. As duas áreas de
  "Espaço Livre" chegam como texto da ficha (na ficha real eram as habilidades gerais do jogador,
  perdidas inteiras). E em qualquer ficha, o campo preenchido que ficou sem rótulo aproveitável não
  some mais: vai pro texto da ficha, com a caixa de trazer ou não. Regra dele: "qualquer anotação
  de player no pdf precisamos trazer".

- **Fontes: Nunito e Determination** — a Nunito (arredondada, indicação do juba) vem empacotada;
  a Determination (a pixelada de Undertale, indicação do sat) é só uso pessoal, então entra pelo
  nome: quem tem instalada vê, quem não tem vê a reserva. As Preferências ficaram um pouco mais
  largas pra caber o nome inteiro da fonte com o crédito.

- **Botão "Histórico" na linha do resultado** — pequeno, ao lado da soma, pra não ter que abrir as
  Preferências.

- **Cada bloco vazio da Ficha diz pra que serve** — uma ficha importada mostrava caixas brancas
  mudas (a Aparência era só branco).

- **O personagem inteiro num arquivo (§3.2)** — pedido dele: "um exportável de ficha, para a
  pessoa poder mostrar pro mestre a ficha ou talvez usar isso para fazer upload em outro pc, ter um
  jeito de já estar tudo ajeitadinho, com designs dos dados, anotações, presets — pra que alguém
  que já use bastante não perca suas informações". Na Ficha, **Exportar personagem** grava um
  `Nome - Reroll.html` com TUDO do personagem: ficha (seções, blocos, barras, regra de crítico,
  descansos, HUD e condições), diário, presets COM as estrelas, foto e a aparência dos dados (cores,
  acabamento, bandeja, torre, imagem de fundo, modo de lançamento). O arquivo é um `.html` de
  propósito — são dois usos num só: abre em qualquer navegador, sem o app, com a ficha desenhada no
  visual 98 (é o "mostrar pro mestre"), e leva o pacote em JSON embutido num `<script
  type="application/json">` que o navegador ignora e o Reroll lê de volta em **Importar personagem
  Reroll** (é o "outro PC"). A página não tem NADA de fora — nem script, nem fonte, nem imagem
  por URL — e todo texto do personagem vira texto nela, nunca marcação (um preset chamado
  `</script>` não fecha o bloco: o `<` vai escapado no JSON). Importar ATUALIZA o personagem que
  já existe com o mesmo nome (ficha, presets e aparência substituídos pelo arquivo, mesmo com ele
  aberto) e só cria um novo quando não há — pedido dele: "não precisa criar outro, quero que sempre
  esteja no limite de 3 personagens para todos os testadores"; tudo ou nada, como a importação de
  ficha (se a ficha ou os presets falharem, lista, ficha e presets voltam ao que eram). O convite
  da ficha vazia ganhou o botão de
  importar também, porque quem chega num PC novo começa exatamente dali. A lista do que é
  "aparência do personagem" saiu do renderer pra `shared/types/aparencia.ts`, porque passou a
  atravessar o arquivo. Coberto por `pacoteDePersonagem.test.ts` (ida e volta, escapes, recusas,
  campo torto corrigido), `pacoteDePersonagem.node.test.ts` (exportar e importar com disco de
  verdade, teto, arquivo grande recusado antes de ler) e a fase `pacote` do harness no app
  compilado (o pedido de exportar leva a aparência da cena; importar troca pro personagem, a ficha
  aparece, a aparência dele passa a valer e os presets estão na Rolagem).

- **Copiar rolagem pro chat (§3.5)** — um botão de copiar na linha de resultado, em cada entrada
  do histórico e no painel do modo compacto. Sai uma linha só, pronta pro Discord/WhatsApp:
  `🎲 Percepção: 1d20 + 5 → [12] +5 = **17**` — nome do golpe, expressão, cada dado, modificador
  e o total em negrito Markdown (os dois asteriscos, que os dois chats renderizam). Dado descartado
  por regra de manter vai entre parênteses e o mantido em negrito; explosão sai por extenso
  (`14(6+6+2)`); fórmula com alvo termina em `✓ sucesso`/`✗ fracasso`. Vantagem e desvantagem
  mostram AS DUAS tentativas (`[**18** | (4)] … (vant.)`) — pra isso a rolagem passou a guardar a
  tentativa perdida (`descartados`), que antes era calculada e jogada fora. Duas preferências
  novas: "Copiar com negrito" (desligue pra chat que mostra os asteriscos) e "Copiar toda
  rolagem" (cada rolagem já vai pra área de transferência sozinha). A cópia passa pelo processo
  principal (`clipboard:writeText`, só texto, com teto) porque o preload roda em sandbox e não
  tem o módulo `clipboard`.

- **Crítico e falha (§3.7)** — o 20 natural e o 1 natural viram eventos: um segundo de clarão
  sobre a cena (painel amarelo sobre preto com oito faíscas quadradas voando no crítico; painel
  bordô tremendo na falha — cores chapadas, sem degradê), uma fanfarra curta ou um "womp"
  sintetizados na hora (Web Audio, sem mp3 novo), e a marca ⭐/💀 ao lado do total, no histórico,
  no painel compacto e na linha do chat. Quem decide é o dado NATURAL que CONTA: nunca o total
  com modificador, nunca o dado descartado (em vantagem é o mantido; em "3d20 usa o maior" é o
  maior), e num dado explosivo é a primeira face da cadeia. A regra é POR PERSONAGEM, na Ficha ao
  lado do sistema: d20 "máximo é crítico" por padrão; d100 "1 é crítico, máximo é falha" pra
  Cthulhu (ficha importada de Cthulhu já nasce assim); "sem crítico" pra sistema que não tem.
  Dois interruptores nas Preferências, clarão e som separados — o som ainda segue o geral.

- **Favoritos (§3.9)** — uma estrela na coluna esquerda de cada cartão de preset marca o
  favorito (até seis por personagem); os favoritos sobem pro topo da lista, com fundo de caixa
  afundada e setas ▲▼ pra escolher a ordem. O MODO COMPACTO passa a mostrar só os favoritos,
  nessa ordem — a janelinha vira o painel da sessão: o golpe principal, a percepção, o dano, e
  as barras de PV embaixo. Sem nenhum favorito, mostra todos como sempre. A estrela é de quem
  usa, não do preset: não entra no editor nem viaja no exportar/importar. Dois canais novos
  (`presets:setFavorito`, `presets:moverFavorito`) que devolvem a lista reindexada — apagar ou
  desmarcar nunca deixa buraco na fileira.

- **Retrato tirado do PDF (§3.6)** — a importação procura na primeira página a maior imagem
  raster com cara de foto (mínimo 64px, proporção entre 2:5 e 2:1, e NÃO a ficha digitalizada
  inteira, que tem a proporção da página) e a oferece na conferência ao lado do nome, reduzida a
  384px em JPEG: usar, trocar por um arquivo seu, ou tirar. Sem imagem que sirva, importa sem
  retrato — nunca segura a importação. "Sem retrato" num personagem atualizado não apaga a foto
  que ele já tinha.

### Alterado

- **A foto tem recorte com ZOOM NO ROSTO** — pedido dele ("quero algo que seja zoom no rosto").
  Escolher a foto (na Ficha ou na conferência da importação, inclusive a tirada do PDF) abre um
  quadro de 256px: arrasta pra centrar o rosto, zoom pela roda do mouse ou pelo controle (até 4×),
  "Centrar" volta ao chute inicial — que já olha pra parte de cima do retrato, com 15% de zoom —
  e "Usar esta" grava um quadrado JPEG de 384px. Sem detector de rosto de propósito: é a pessoa
  quem diz onde o rosto está, e a geometria é uma só pra prévia e pro arquivo (`recorteDeFoto.ts`,
  testada). "Recortar…" embaixo da foto que já existe reabre o quadro.

- **Preparar pra qualquer ficha: mais grafias de recurso** — "12 de 40", "12 of 40", "45 (60)",
  "HP Current"/"HP Max", "Sanidade Atual"/"Máx", e MP/PM/Mana como nomes vitais. Uma DÉCIMA LEVA
  de PDFs fabricados cobra a lista exata de barras de cada grafia (`espera.barras` no corpus) e
  inclui uma ficha com a FOTO num botão de imagem de formulário e um logo maior desenhado na página
  — o harness prova que a foto (3:4, muitas cores) vence o logo (quadrado, duas cores).

- **Fonte um tamanho maior** — pedido dele ("aumentar 1 tamanho da fonte"): o texto-base foi de 13
  pra 14px, botões e campos de 12 pra 13, e os textos com tamanho próprio subiram junto (cartão de
  preset, campos da Ficha, crachá, HUD, histórico, Preferências). Medido de novo: a aba de Rolagem
  continua cabendo em 1300×800 sem rolar, e nenhuma das sete fontes transborda.

- **O seletor de personagem não repete a foto** — pedido dele ("a lista com foto tá estranho porque
  aparece a foto duas vezes"): o botão fechado, que fica ao lado da foto grande na Ficha, mostra só
  o nome; a miniatura continua na lista aberta, onde há vários pra distinguir.

- **Foto do personagem QUADRADA, como avatar da Steam** — pedido dele ("mais quadrada, tipo um zoom
  no rosto"). Era 3×4 de foto de documento em todo lugar; agora é quadrada no crachá da rolagem
  (56×56), no seletor e no crachá das anotações (32×32), na Ficha (112×112), no HUD (44×44; 30×30
  no mini e no retrato de "mostrar") e na conferência da importação (72×72). O quadrado cortava a
  cabeça de um retrato — foi por isso que a foto virou 3×4 um dia —, então a volta vem com o
  remédio: `object-position: center 20%` puxa o recorte pra cima, onde o rosto está.

### Adicionado (a ficha parecida com o PDF, spec da importação §9)

- **A página do PDF ao lado dos campos, na conferência** — pedido dele: "as fichas precisam ser
  intuitivas e o mais parecido possível com os PDFs"; e a spec: "side-by-side view: show the
  original PDF page next to the fields, so the user can compare without leaving the app". Na
  importação o pdf.js desenha cada página numa imagem (até seis, 1000px de largura, JPEG), e a
  tela de conferência ganha uma coluna à esquerda com a folha, setas e "Página 1 de 3", ao lado de
  tudo o que já existia. Conferido no app compilado com as treze fichas reais do corpus: a página
  aparece legível em todas. Os CAMPOS PREENCHIDOS aparecem na folha: medido no app, a ficha do
  Matias vinha com todo campo vazio nos modos normais do pdf.js (ele só pinta a aparência que o
  arquivo traz, e muita ficha é salva só com o valor); o caminho que funciona é o da impressão de
  formulário, semeando cada valor lido no `annotationStorage` e desenhando em ENABLE_STORAGE.

- **A ficha original fica com o personagem** — as páginas vão pra pasta dele (`pagina-01.jpg`...,
  ver `PaginasRepository`; arquivos, e não dentro do `notes.json`, que é gravado a cada tecla), e
  a aba Ficha ganha o bloco "Ficha original (PDF)" com o botão "Mostrar as N páginas": as folhas
  abrem ali mesmo, em tamanho de leitura, embaixo dos campos editáveis. Reimportar traz as
  páginas novas no lugar; apagar o personagem leva as páginas pro backup junto com o resto.

- **O pacote exportado leva as páginas** — o `.html` que vai pro mestre mostra a ficha original
  embaixo dos campos, e importar noutro PC traz as páginas junto.

- **A foto nos quatro lugares, testada** — fase `retrato` do harness: imagem alta (300×900), larga
  (1200×300), minúscula (16×16), enorme (3000×3000), PNG transparente e retrato 3×4 sem recorte,
  cada uma conferida na Ficha, no crachá da Rolagem, no HUD e no seletor de personagem: caixa
  quadrada, imagem dentro, `cover` sem esticar, recorte gravado em 384×384. Trinta e oito
  checagens, nenhum defeito.

### Adicionado (segurança de dados, spec §8.1 e §9.1)

- **Backup da pasta de dados antes de abrir uma versão nova** — na primeira abertura de cada
  versão o app copia perfis, fichas, presets e preferências pra
  `%APPDATA%\reroll\backups\pre-<versão>-<data>\`, com um LEIA-ME dizendo como voltar; ficam os
  três últimos. É o que a spec põe como prioridade máxima ("data loss on update is the single most
  trust-destroying bug possible"): o app corrige o formato na leitura e grava por cima na primeira
  tecla, e se uma versão ler errado o arquivo de antes dela ainda existe. Falha de backup é aviso
  no console, nunca o app sem abrir. `backupsDeDados.node.test.ts`, com disco de verdade.

- **Personagem apagado vai pra backup** — a pasta dele sai de `profiles\` (onde ficava órfã, e
  ninguém achava) e vai pra `backups\personagens-apagados\<id>-<data>\`. O "tem certeza?" passou
  a dizer isso. Apagar por engano continua recuperável: copiar a pasta de volta.

- **Histórico de rolagens por personagem, gravado** (spec §3.2) — morava na memória da tela e
  sumia ao fechar o app, e era o mesmo pra todo personagem. Agora é o `historico` do `notes.json`
  dele: trocar de personagem troca o histórico, fechar o app não apaga, e o pacote exportado leva
  ele junto. Os últimos 100 itens.

- **Build portátil** (spec §8.4) — a release passa a ter também `Reroll-Portatil-<versão>.exe`, um
  arquivo só, sem instalador, pra quem não confia em instalador sem assinatura. Ela não se
  atualiza sozinha (o atualizador só troca instalação NSIS): o app reconhece que é portátil e as
  Preferências dizem onde baixar a nova, sem botão de procurar.

### Testado

- **A fase `perfis` do harness** (`scripts/testarNoApp.mjs`) — pedido dele: "vamos continuar
  testando, deixando clean e menos buggy, com presets, mais dados, mais perfis, se tudo funciona,
  trocar de perfil, importar, exportar". Três personagens com ficha, presets e aparência
  diferentes, e o roteiro inteiro no app compilado: abrir no primeiro; trocar pelo seletor e
  conferir que ficha, presets, cor do dado, forma da bandeja e crachá trocam juntos; digitar no
  inventário de um, ir pro outro e voltar (gravou no certo, o outro não ganhou nada); criar preset
  com fórmula, rolar por ele, favoritar, editar o nome, apagar pelo diálogo do app; 2d20 + 3d6 +
  1d100 de uma vez no modo rápido (seis dados, soma certa); renomear na Ficha (seletor e lista
  acompanham); no teto de três, "Novo personagem" cinza e importar um nome novo recusado com o
  aviso; exportar leva a aparência do personagem certo; apagar um personagem deixa o app noutro,
  com os presets dele; o diário das Anotações é por personagem; e trocar de personagem com a cena
  3D montada remonta a bandeja na forma do novo e o dado continua assentando. Trinta e cinco
  checagens, todas verdes. O processo principal falso do harness ganhou `presets:update` e a
  estrela de verdade (`presets:setFavorito`), e o console do renderer passou a ser capturado pra
  diagnosticar um passo que falhe. Uma corrida deu "não assentou em 20s" logo depois da cena
  remontar, com a máquina ocupada pelo harness inteiro que tinha acabado de rodar; três corridas
  isoladas em seguida assentaram em 3,5 a 4,7s. É a carga, não a bandeja (ver o teste do
  `diceEscape`, que tem a mesma sensibilidade).

### Removido

- **Courier New, Segoe UI e Impact saem do menu de fontes** — pedido dele (segunda limpeza); as
  três continuam como reserva de quem ficou.

- **O seletor de idioma** — pedido dele: "vamo remover inglês, foda-se, depois botamo, vamo deixar
  only pt-br". O app fica só em português; quem tinha escolhido inglês volta pro português na
  próxima abertura. O dicionário em inglês continua no código, testado, pra voltar quando ele
  mandar.

### Corrigido

- **O aviso de atualização aparecia BRANCO no modo noite** — a caixa do "o que mudou" usava uma
  variável de cor que não existe em tema nenhum e caía no branco fixo, com texto quase branco por
  cima. Mesma família de defeito na opção marcada do seletor de personagem (preto sobre azul no
  modo dia), no modo rápido e na marcação do ícone nas Preferências. Todas com as cores do tema.

- **"Full screen buga dependendo do tamanho do monitor"** (tester) — a janela cheia era
  1300×800, maior que a área útil de um notebook 1366×768 ou de um 1080p a 150%: saía com título
  e borda pra fora da tela. Agora é 1200×760 e nunca passa da área útil do monitor onde está.

- **Enter que fecha um campo não rola mais os dados** — confirmar um campo com Enter desmontava o
  campo antes de o atalho de rolar ver onde a tecla nasceu, e a rolagem disparava junto.

- **A prévia da aba Estilo saía escura** — "as cores do editor e da mesa tão bem diferentes":
  faltava na prévia o mesmo ambiente de reflexo da cena; medido, a amostra saía com menos da metade
  do brilho. Agora é idêntica à mesa.

- **O nome da fonte saía cortado no seletor** ("Determi…"): o seletor ganhou largura própria,
  medida no pior caso da lista.

- **Os travessões que sobraram fora do dicionário** — "nas config tem muito travessão também". O
  "Versão —" das Preferências enquanto a versão carrega (virou "..."), o total do modo rápido antes
  da primeira rolagem, o traço dos presets sem fórmula, o título do retrato ("Nome — Sistema" virou
  "Nome (Sistema)"), a linha do histórico, os ataques do leitor de Pathfinder ("+5 · 1d6 — Brawling"
  virou vírgula) e as mensagens da gramática de fórmula ("Dado sem número de lados: escreva d20").

- **Apagar um preset travava o teclado** — os dois bugs que ele achou ("se criarmos um preset,
  colocarmos nome e tudo, e apagarmos não conseguimos criar outro" e "se uploadarmos uma ficha e
  apagarmos um preset, a ficha buga, não conseguimos editar mais nada dela") são o mesmo defeito:
  o "tem certeza?" era o `confirm()` nativo do Electron, e no Windows a janela não recupera o foco
  do teclado depois que ele fecha — o clique ainda funciona, mas nenhum campo aceita letra, nem o
  nome do preset novo nem os campos da ficha. Agora todo "tem certeza?" e todo aviso são um
  diálogo DO APP (`Dialogo.tsx`: cartão 98, OK/Cancelar, Esc cancela, Enter confirma), e o foco
  fica onde estava. Trocados os oito lugares: apagar preset, exportar/importar, os erros do
  favorito, apagar página e seção, remover personagem, aplicar o estilo a todos e as duas perguntas
  da atualização. O harness ganhou a fase `presets`, que faz exatamente o roteiro dele no app
  compilado: criar, apagar pelo diálogo, criar outro e DIGITAR o nome; importar a ficha do Matias,
  apagar um preset e digitar num campo da ficha — grava.

- **O que o app compilado mostrou** (`scripts/testarNoApp.mjs`, o harness que abre o renderer de
  produção numa janela oculta com um processo principal falso e clica, rola, importa e arrasta —
  pedido dele: "vamos continuar testando os tipos de hud, os d20, os tipos diferentes de dados, os
  uploads, os scrapings"). Os sete tipos de dado, 3d6+5, vantagem/desvantagem, ⭐/💀, a linha do
  chat, o histórico e um d20 assentando na bandeja 3D passaram de primeira. Depois entraram as
  fases `dados3d` (os sete tipos e um 3d6 caindo na bandeja de verdade, d100 em ~6 s), `sons`
  (`play()` do áudio e os osciladores do Web Audio instrumentados: a rolagem toca uma vez, a
  fanfarra de quatro notas e o "womp" tocam no ⭐/💀, e NADA toca com o som desligado ou só com o
  som de crítico desligado), `foto` (o recorte abre, zoom e arrasto mexem, grava 384×384) e
  `fabricados` (a décima leva pela conferência, com a foto vencendo o logo). O que não passou, e
  foi consertado:
  - **O HUD transbordava a cena** com doze barras e vinte condições (477px num canvas de 462): agora
    tem altura máxima e o miolo (barras e condições) rola; cabeçalho e Descansar ficam parados.
  - **O arrasto do HUD não encaixava** quando o mouse saía do cabeçalho — todo arrasto rápido —,
    porque o `pointerup` chegava ao canvas: o mover e o soltar passaram a ser ouvidos na janela. E o
    canto passou a ser decidido pelo CABEÇALHO (o que se segura), não pelo centro do cartão: um
    cartão de doze barras é mais alto que metade da cena e pelo centro nunca chegava ao norte.
  - **Oblívio propunha doze barras de ATRIBUTO** ("Carne 0/10", "Coragem 0/10"…): "n/m" em grupo de
    atributos ou aspectos é escala, não reserva, e não vira barra; "0/0" em branco também não. Sobram
    as partes do corpo (Torso 0/5, Braço 0/3), que são dano. Teste com as fichas reais
    (`barrasDasFichasReais.node.test.ts`).
  - **Assimilação não propunha barra nenhuma**: "Saúde 18", "Determinação 8", "Assimilação 2" são um
    número só, sem par — viram barra cheia no valor quando o nome é de recurso vital (lista curta:
    "Vontade" parecia e é perícia em Ordem — virava "Vontade 10/10" no Vincenzo).
  - **O retrato do Kieran era um triângulo vermelho**: a maior imagem com proporção de foto era um
    logo. Candidatas da maior pra menor, e cada uma passa por "parece foto?" — 64×64 em 4 bits por
    canal, mínimo de 120 cores distintas (o triângulo com serrilhado e JPEG dá dezenas; uma foto,
    centenas). A lista de operadores passou a incluir a aparência dos campos de formulário
    (`annotationMode`), que é onde a foto de uma ficha preenchível mora.

- **"Fontes bugaram quando trocando"** — nas Preferências, a linha "Como o resultado aparece" dava
  largura elástica ao `<select>` e nenhuma ao rótulo: o rótulo com dica embaixo encolhia até ~100px
  e, com uma fonte mais larga (Montserrat), a dica virava uma coluna de seis linhas de uma palavra.
  Reproduzido trocando a fonte no app compilado numa janela oculta; em Tahoma já era apertado, só
  menos visível. Agora o rótulo é o elástico da linha e o seletor tem largura própria — e nessa
  linha, a única com dica longa e seletor, ele vai EMBAIXO do rótulo. As sete fontes foram medidas
  na aba de Rolagem e nas Preferências: nenhuma transborda.

- **"Rolar os dados, recursos e presets estão passando um em cima do outro"** (relato dele, na
  primeira olhada nas barras). Três causas, todas MEDIDAS no app de verdade numa janela oculta
  (`scripts/medirAbaDeRolagem.mjs`, que abre o renderer compilado com IPC falso e mede as
  seções): (1) a seção da cena tinha `flex: 1` inline — que é `1 1 0%`, pode encolher — e o
  conteúdo dela (canvas de 420px + linha de resultado) vazava 20px por cima das barras; virou
  `flex: 1 0 auto`. (2) Aí apareceu uma catraca: os atributos `width/height` do `<canvas>` são o
  tamanho intrínseco dele, e num contêiner de altura automática ele passou a ditar a própria
  altura (628px onde cabiam 420); o canvas ficou fora do fluxo (absoluto) e o `setSize` do three
  não escreve mais estilo inline. (3) Com tudo no lugar a aba passou a ROLAR na janela padrão
  (748 de conteúdo em 716): a faixa de recursos passou pra linha de controles da cena e, na
  sequência, saiu de lá também — pedido dele: a mesma barra em dois lugares da mesma tela era
  uma a mais. As barras moram SÓ no HUD sobre a cena (e na janelinha do modo compacto), com o
  lápis de criar/editar e o Descansar dentro do HUD. A caixa "Rolagem" ficou com base de 520px,
  que é o tamanho do conteúdo dela (media 464 onde pede ~510: "Desvantagem" cortado e o crachá
  por cima dos botões). Resultado: 716 em 716, nada se sobrepõe.

### Interno

- **As anotações viraram uma instância só** (`NotesProvider`): a aba Ficha e a aba Anotações
  chamavam `useNotes` cada uma por conta própria — duas cópias do mesmo arquivo, que funcionavam
  porque nunca estavam montadas juntas. Com as barras na tela de rolagem (sempre montada), um
  clique no "−" gravaria as seções de ANTES da última edição na Ficha por cima do que a pessoa
  acabou de escrever. E importar a ficha por cima do personagem já aberto agora RELÊ as anotações
  (`recarregar`) — antes o `activeId` não mudava, a tela ficava com a ficha velha, e a próxima
  tecla gravava as seções velhas por cima das novas.

- `afundarDosBotoes.mjs` ganhou as quatro famílias novas ("−"/"+" da barra, cheia e compacta; o
  número; o lápis). A primeira versão afundava só MEIO pixel: conteúdo centralizado com padding
  zero não tem de onde tirar — partir de 1px em volta e ir pra `2px 0 0 2px` é o que anda (1, 1).

## [1.1.0-beta.4] — 2026-08-25

A ficha de um personagem novo agora nasce VAZIA de verdade — um convite pra importar o PDF, que é o
que este beta está testando —, em vez de cinco caixas de texto pedindo pra ser preenchidas.

### Alterado

- **A ficha vazia convida a importar.** Personagem sem seção importada e sem uma letra nos blocos
  mostra "Esta ficha está vazia" com o botão de importar o PDF em destaque e um "Prefiro preencher
  à mão" como segundo caminho. Basta uma seção importada ou uma palavra digitada pra ficha voltar a
  ser a de sempre — ninguém que já escreveu perde nada. Pedido do usuário: "deixa a ficha vazia,
  para a pessoa poder usufruir e fazer questão de uploadar uma para testar".

### Para quem testa (beta.4)

- Crie um personagem novo (ou abra um vazio) e importe a SUA ficha em PDF pelo botão do convite.
  Confira o que foi lido e conte o que veio errado — é o que a gente quer saber.

## [1.1.0-beta.3] — 2026-08-25

Um update pequeno, de propósito: o beta segue com a Ficha (beta) e o preset de fórmula do beta.2, e
a única mudança é o TETO DE PERSONAGENS — três por enquanto. Mais vão sendo liberados nas próximas
versões. Este é o primeiro beta que chega pelo atualizador: quem está no 1.0.x ou no beta.2 recebe
a pergunta de atualizar na próxima abertura.

### Alterado

- **Até três personagens neste beta** (`MAX_PROFILES`). O "Novo personagem" e a importação de
  ficha param no terceiro, com o aviso de sempre. Quem já tem mais que três (o beta.2 deixava
  quinze) NÃO perde ninguém: o teto vale na criação, nunca na leitura — os que existem continuam
  lá, editáveis e apagáveis; só não nasce um quarto. O disco continua aceitando até quinze
  (`TETO_DE_PERSONAGENS_NO_DISCO`), pra o arquivo de quem tem mais continuar sendo gravado.

### Para quem testa (beta.3)

- Nada muda no que você já tem: personagens, fichas, presets, anotações e cores ficam onde estão
  (`%APPDATA%\reroll`, que o instalador não toca).
- O instalador é `Reroll-Setup-1.1.0-beta.3.exe`, com o SHA-256 no `SHA256SUMS.txt` ao lado. Se
  for instalar à mão: `Get-FileHash .\Reroll-Setup-1.1.0-beta.3.exe -Algorithm SHA256` e compare.

## [1.1.0-beta.2] — 2026-08-24

O beta pros testadores de verdade: a bandeja fala a gramática (preset de fórmula), quatro levas de
scraping (Pathfinder fabricado, quinze sistemas novos, a estrutura que todo PDF real tem, e o
"qualquer PDF" que um testador vai arrastar), dois leitores novos (a ficha da comunidade de Ordem
Paranormal e Assimilação), os botões afundando como o 98 manda — medido pixel a pixel —, e os
ciclos todos provados: apagar e reimportar, trocar e destrocar, fechar sem salvar. Entregue À MÃO,
como o beta.1: quem está no 1.0.x não recebe pelo atualizador.

### Interno (preparo do lançamento)

- **O clone limpo não estoura**: dois testes liam a pasta `Fichas RPG/` (que é material das
  editoras, ignorada pelo git e ausente em qualquer clone) com `readdirSync` no topo do módulo —
  em CI isso quebrava a COLETA em vez de pular. Guardados com `existsSync`; a suíte inteira foi
  rodada COM a pasta renomeada pra fora, simulando o clone do lançamento: 1122 testes passando e
  20 pulando de forma limpa, zero erros. Nenhum PDF está no repositório nem entra no instalador
  (a lista de arquivos do empacotador é nomeada, não curinga).

### Para quem testa (beta.2)

- O instalador é `Reroll-Setup-1.1.0-beta.2.exe`, entregue junto do SHA-256 dele. Antes de
  instalar: `Get-FileHash .\Reroll-Setup-1.1.0-beta.2.exe -Algorithm SHA256` e compare.
- O que testar de novo: importar QUALQUER PDF (ficha de qualquer sistema — e até o que não é
  ficha: a conferência mostra o que foi lido e você desmarca o que não quer); presets com a
  fórmula escrita (`2d6r<2`, `6d6#>=5`, `1d20+5 >= 15`); as lacunas da ficha (digite o valor e o
  botão de rolar nasce); trocar de personagem e conferir que cores, ficha e presets voltam.

### Adicionado

- **O preset de FÓRMULA — a bandeja rola o que a gramática lê.** O primeiro item do "Conhecido
  nesta beta" sai da lista: rerolar (`2d6r<2`), contar sucessos (`6d6#>=5`), alvo no fim
  (`1d20+5 >= 15`, que vira Sucesso/Fracasso na tela), multiplicação (`(1d8+2)*2`), dado subtraído
  e manter por grupo (`2d20kl1 + 1d4`) deixaram de ser recusados no editor e viraram preset de
  verdade. O que os botões sabem dizer continua gravado como sempre (`expression`); o que só o
  texto descreve é gravado como fórmula (`formula`, na forma canônica), um dos dois e nunca ambos —
  dois retratos da mesma rolagem podem discordar, e aí o preset rolaria diferente do que está
  escrito. No editor, escrever uma dessas fórmulas troca o aviso de recusa pelo modo fórmula: os
  controles de dados saem de cena (eles descreveriam OUTRA rolagem) e voltam se o texto voltar a
  caber neles. Só a referência à ficha (`@STR.mod`) segue recusada, com a mesma mensagem: o preset
  ainda não lê a ficha na hora de rolar.
- **Como rola: em ondas, com dados de verdade** (`shared/dice/rolagemPorEtapas.ts`). A avaliação da
  gramática é síncrona e a cena leva segundos — a ligação é por REPLAY: um diário de faces colhidas,
  reavaliado a cada onda; o que falta vira o próximo arremesso, o mesmo gesto que a explosão já
  encenava. `2d6r<2` cai como 2d6 e o dado que pediu reroll volta sozinho; uma fórmula de dois
  termos cai em duas levas, como uma pessoa rolaria na mesa. No modo rápido e no compacto a mesma
  gramática resolve na hora, com o mesmo RNG de sempre. Validação num lugar só
  (`conferirFormulaPraBandeja`), cobrada no editor e no main process (criar, editar, importar
  arquivo): fórmula que não lê, tipo que a bandeja não tem, termo maior que uma onda (20 dados) e
  referência à ficha não chegam ao disco. 24 testes novos do motor, mais os do editor e da
  validação.
- **O resultado conta a história toda.** Histórico e painel marcam dado a dado o que contou pro
  total — com marca PRONTA no resultado (`mantidos`), porque nas regras por termo e na contagem a
  tela não teria como refazer a conta —, o reroll diz a face descartada ("rerolou: caiu 1"), a
  explosão mostra a cadeia como antes, e o alvo julga a rolagem inteira: ✓ Sucesso / ✗ Fracasso
  junto do total. No compacto, resultado de fórmula vira lista de faces ("3, 6, (2)"), não uma soma
  que mentiria onde há multiplicação ou contagem.

- **Leitor de Pathfinder 2e** (`readers/pathfinder2e.ts`), pra família de fichas preenchíveis
  "Ficha Editável com Cálculos" — a que tem nomes de campo com significado (`Character Name`,
  `STRENGTH STAT`, `FORTITUDE`, `MELEE STRIKE 1 DAMAGE`). Identificação, atributos (o modificador,
  com sinal), salvaguardas, as dezesseis perícias e os dois Conhecimentos, percepção, CA, CD de
  classe, PV máximo (e PV atual como lacuna, que o modelo não tem), deslocamento, pontos de herói,
  ataques corpo a corpo e à distância como presets de ataque e dano, proficiências, magia quando há,
  ações e reações, talentos, inventário com volume e moedas. Total de perícia ou salvaguarda que o
  PDF deixou vazio (ele calcula por JavaScript e só grava quando alguém toca) é refeito da soma dos
  componentes — conferido na ficha real: 7 = Destreza 4 + proficiência 3. A grade à distância do
  modelo numera nome e dano em `4/5/6` e o bônus em `1/2/3`; o leitor lê as duas numerações.
  A ficha oficial da Paizo nomeia os campos como `text_15gujr` e fica no leitor genérico.

### Adicionado (continuação)

- **A sexta leva de PDFs de teste: mais oito fabricados** (`testes/sextaLevaDePdfs.ts`), fechando o
  buraco maior do corpus — o leitor de Pathfinder 2e não tinha NENHUM caso fabricado, só as fichas
  reais que moram fora do repositório. A "Editável com Cálculos" preenchida (total vazio refeito
  dos componentes, atributo negativo, a grade à distância torta, pontos de herói em caixa, moedas,
  o duplo espaço e o erro de digitação do modelo), o modelo em branco, a estilo-oficial da Paizo
  (nomes `text_15gujr` caem no genérico), rótulo impresso na posição que não rotula, campo oculto
  com botão de imprimir, valor em UTF-16 com BOM, valor herdado do campo pai (`/Parent`) e uma
  Kids on Bikes datilografada ("Músculos: d12" vira campo e preset). `ESCREVER_PDFS=1` escreve os
  trinta e oito. Dois defeitos que ela achou, consertados:

- **A sétima leva: quinze sistemas que o app nunca viu** (`testes/setimaLevaDePdfs.ts`), todos pelo
  leitor genérico — Savage Worlds (dado por atributo, "d8" vira preset), Cthulhu em formulário
  (porcentagens, nenhum preset inventado), Vampiro V5 (bolinhas "•••" atravessam), Fate, GURPS
  ("2d-1" não vira rolagem torta), Cyberpunk RED, Blades in the Dark ("3/9"), Tormenta20 em branco,
  Daggerheart, OSR B/X (THAC0), M&M, Numenera, Monster of the Week (bônus negativo), Shadowrun,
  Troika! e Cairn — dezesseis casos, do 39 ao 55.
- **Troca e destroca de personagem tem teste de visual** (`trocaDeVisual.test.tsx`) — pergunta do
  usuário: "troca e destroca mantém os mesmos designs?". Mantém, e agora está provado: pinta A,
  troca pra B, pinta B, volta pra A e cada um fica com as próprias cores e modo de lançamento —
  inclusive depois de fechar e reabrir. O visual mora fora dos arquivos por perfil (localStorage,
  ver `PROFILE_LOOK_KEYS`) e não tinha ida-e-volta testada.
- **`NOVIDADES-DESDE-0.1.3.txt`**: o resumo pros usuários da 0.1.3 do que mudou até a 1.0.11, em
  linguagem de gente, pronto pra mandar junto do "é só aceitar a atualização".

- **A oitava leva: a estrutura que todo PDF real tem** (`testes/oitavaLevaDePdfs.ts`, casos 56–63)
  — o corpus inteiro era de PDF sem compressão, que é como se fabrica arquivo legível a olho e como
  nenhum exportador grava. Entraram: fluxo de conteúdo com FlateDecode, campo de ASSINATURA digital
  (o `/V` é dicionário, não texto de ninguém), arquivo ANEXADO dentro do PDF (ignorado, como o spec
  manda), título desenhado letra a letra (o pdf.js remonta "F O R Ç A" e ele é o rótulo — medido
  com o dump), D&D TRADUZIDA (nomes de campo em português caem no genérico com os rótulos
  impressos e o preset do dano), valor com CRLF e tab, duas fichas no mesmo arquivo (o nome
  proposto é o da primeira) e dinheiro/data/peso que parecem rolagem e não são.
- **O ciclo "apaga e sobe de novo" tem teste de ponta a ponta**
  (`apagarEImportarDeNovo.node.test.ts`) — pedido do usuário. Importa a ficha fabricada pelo
  caminho inteiro (bytes → pdf.js → leitor → conferência → IPC), escreve um dia de diário, APAGA o
  personagem, importa o MESMO PDF: a segunda vem tão completa quanto a primeira (mesmos campos,
  mesmos presets — a deduplicação é por pasta, e pasta nova não herda nada), o diário do apagado
  não vaza pro novo, a pasta dele fica no disco como sempre, e o ciclo aguenta repetição.

### Adicionado (lacunas e reteste)

- **As lacunas da ficha têm teste de tela** (`lacunasNaFicha.test.tsx`) — o contrato dos "espaços
  de lacuna" que a importação traz vazios de propósito: lacuna é editável e vazia NÃO tem botão de
  rolar; o que se digita nela é gravado com o `roll` atravessando junto (sem ele o botão morreria
  na releitura); quando o número chega numa lacuna que é rolagem no sistema, o botão de dado NASCE
  na hora e rola a regra daquele sistema (Agilidade 3 em Ordem = 3d20 usando o maior); lacuna sem
  tipo (PV atual) grava e segue sem dado. Quatro testes, com o fluxo real da aba (useNotes +
  gravação).
- **Reteste dos botões repetido**: 11/11 afundando (1, 1) pixel-perfeito. Uma rodada isolada acusou
  1 erro que não se repetiu em duas execuções seguidas — anotado como captura antes da pintura
  assentar; se voltar, vira investigação.

### Adicionado (Assimilação)

- **Leitor de Assimilação** (`readers/assimilacao.ts`) — a ficha do Kieran chegou "não bem
  organizada" pelo genérico (27 campos em "Outros", caixa marcada virando "Aptidao40 = sim"), e a
  sondagem explicou: é ARTE digitalizada com formulário por cima, zero texto impresso — os nomes de
  instintos e aptidões são pixel. O leitor organiza pelo que os 288 nomes de campo dizem de
  verdade: Identificação (Nome, Ocupação, Geração, Evento, os dois propósitos pessoais e o
  coletivo como lacuna), os três Recursos por extenso (Saúde, Determinação, Assimilação — as
  trilhas de toggles ficam de fora, são desenho de marcar), as caixinhas marcadas viram UMA linha
  de números por grade ("Instintos marcados: 5, 21, 22" — dizer o nome seria inventar o que só a
  arte tem), características e mutações no bloco de Habilidades, Notas na História. Testado na
  fixture e contra o arquivo real; o Kieran do app instalado foi reimportado já organizado.

### Adicionado (anotações)

- **Teto de 2.000 caracteres por sessão de anotações** (`TAMANHO_MAXIMO_DA_ANOTACAO`) — pedido do
  usuário ("agora que vi que não tinha"). O campo para no teto, o que se cola entra cortado nele, e
  um contador discreto ("1.234/2000") avisa antes — vermelho quando enche. Sessão antiga MAIOR que
  o teto não é cortada na leitura: arquivo velho não perde conteúdo por causa de número novo, só
  não cresce mais. O teto total do arquivo (16 MB na gravação) segue como última defesa.

### Adicionado (o ciclo inteiro, testado com as fichas reais)

- **"Apaga todos e testa de novo"** (`apagarTodosEImportarDeNovo.node.test.ts`) — pedido do
  usuário, com as SETE fichas preenchidas da pasta (Ordem oficial e da comunidade, D&D traduzida,
  Assimilação, Oblívio, Kids on Bikes, Pathfinder do Rilver): importa todas, confere a assinatura
  de cada sistema, escreve um diário, APAGA TODOS os personagens, importa tudo de novo — e a
  segunda rodada sai IDÊNTICA à primeira, campo a campo, bloco a bloco, preset a preset. Nada vaza
  dos apagados; as pastas de quem teve algo gravado ficam no disco (índice se recupera, dado não).
- **"Fechar sem salvar" não existe — e agora está provado** (`trocaDeVisual.test.tsx`): o ciclo da
  pergunta do usuário ("fecha o app, abre de novo, troca as cores, esquece de salvar, fecha de
  novo") virou três testes — trocar a cor e fechar NA HORA (o `pagehide` grava o que o debounce de
  300ms não teve tempo de gravar), trocar e usar por um instante (o debounce grava sozinho), e o
  ciclo inteiro com três sessões.

### Adicionado (fichas novas na pasta)

- **A FICHA DA COMUNIDADE de Ordem Paranormal** (`extrairFichaDaComunidade`) — o segundo modelo do
  mesmo sistema, chegado na ficha real do Vincenzo: atributos `atr_*`, perícias em três campos
  (treino/outros/total calculado por JavaScript — total vazio se refaz da soma, conferido:
  medicina 10+5=15), grade de armas de seis linhas sem coluna de teste, NEX, patente, carga
  atual/máxima, resistências, seis habilidades e a grade de rituais com custo e página
  ("Velocità Mortale · custo 3PE · pág. 150"). Os `ITEM 1…11` têm os mesmos nomes do modelo
  oficial e as lacunas numeradas servem às duas. A oficial continua no caminho de sempre.
- **Campo de LISTA traduz índice pra rótulo** (`rotuloDaOpcao` em `sheetFromPdfDocument.ts`): a
  ficha da comunidade guarda Classe/Origem/Trilha como listas que exportam índice — "CLASSE = 2"
  não é informação de ninguém; as opções do próprio campo dizem que 2 é "Especialista", e agora a
  varredura lê ("Agente de Saúde", "Médico de Combate", proteção "Leve"). A ficha oficial não
  muda: lá o valor de exportação já é o rótulo.
- **Underscore vira espaço no rótulo de nome de campo** (`labelFromFieldName`): a ficha real de
  Assimilação (a do Kieran) nomeia campos como `Propositos_Pessoais` — sintaxe de editor, não
  escrita de gente.
- **Três fichas reais novas com teste de ponta a ponta** (`fichasReais.node.test.ts`): a da
  comunidade de Ordem (Vincenzo), a de D&D 5e TRADUZIDA (a do Go — o modelo mantém os nomes de
  campo oficiais e o leitor de D&D a reconhece inteiro: 63 campos, grupos certos) e a de
  Assimilação (sistema desconhecido rendendo 27 campos legíveis pelo genérico).

### Corrigido

- **Os botões afundam como o 98 manda — todos, medido pixel a pixel.** Reteste pedido pelo usuário
  ("os botões dos dados estão se afundando errado, os dos presets também"). Quatro causas, cada uma
  achada com régua (`scripts/afundarDosBotoes.mjs`, abaixo):
  - o **dado marcado** ficava com a borda afundada e o rótulo parado — o padding compacto da barra
    vencia o do `.btn-selected` por ordem de import — e, no clique, afundava DE NOVO. Agora marcado
    é afundado de verdade, e clicar nele não mexe (mesma regra do bloco de modos);
  - o **"−"/"+" dos chips** invertia a borda com o glifo parado (o `padding: 0` do chip cancelava o
    deslocamento do clique). Agora o glifo anda o 1px de sempre;
  - o **cartão de preset** só escurecia — gesto de outro sistema visual. Agora o clique no rolar
    AFUNDA O CARTÃO (borda invertida via `:has`, só quando o clique é no rolar) e o conteúdo anda
    1px; o lápis e o ✕ afundam o glifo; o dado da Ficha também;
  - a mais escondida: **`border: none` num botão ressuscita no clique** — o `none` zera o estilo e
    deixa a largura no `medium` (3px), e o `button:active` global põe `border-style: inset`, que
    materializa 3px de borda: o conteúdo do cartão pulava (4, 2.5). No compacto era a versão de
    especificidade: `button:active:not(:disabled)` (0,2,1) vencia `.compact-preset:active` (0,2,0)
    e aplicava o padding global de 13px — o rótulo pulava 8px. `border: 0` e `:not(:disabled)` nos
    lugares certos, com o porquê escrito em cada um.

### Interno (reteste de botões)

- **`scripts/afundarDosBotoes.mjs`** — a régua do afundar, reutilizável: janela oculta do Electron
  com o CSS DE PRODUÇÃO (o bundle de `out/renderer`), mouse apertado de verdade (`sendInputEvent`),
  e o veredito por correlação de pixels (que (dx, dy) explica o quadro apertado como o solto
  deslocado — o certo é (1, 1), e marcado clicado é (0, 0)) mais a sonda de layout (rects direto do
  motor). Onze famílias de botão; sai com erro se alguma afundar errado. Rodar depois de
  `npx electron-vite build`: `npx electron scripts/afundarDosBotoes.mjs`. Depois dos consertos:
  11 de 11 com deslocamento pixel-perfeito (erro 0.0).

- **Letra avulsa não rotula campo** (`labelForField.ts`): guarda nova em `ehRotulo` — fragmento de
  um caractere não vira rótulo. Honestidade: o caso que a motivou o pdf.js resolve sozinho
  (remonta as letras da mesma linha), então ela cobre o que ele não remonta; o menor rótulo real
  tem duas letras ("CA", "PV").
- **"Nombre:" também é campo de nome** (`generic.ts`): ficha em espanhol caía no nome do ARQUIVO
  tendo "Nombre: Paco" escrito duas linhas acima — "nome" não casa com "nombre". Entraram
  `nombre` e `personaje` na régua, achado pela sétima leva.
- **Nome automático de exportador não é rótulo** (`labelForField.ts`): campo preenchido sem rótulo
  impresso por perto entrava na conferência como "text_4r5t = 13" — o padrão da ficha oficial da
  Paizo, tipo do controle + sufixo aleatório. O separador é obrigatório no filtro: "Texto" e
  "Datas" continuam sendo nomes de gente.
- **Campo OCULTO não é ficha de ninguém** (`sheetFromPdfDocument.ts`): formulário calculado guarda
  totais internos em campos com a bandeira HIDDEN/NOVIEW, e um "TOTAL_INTERNO = 999" entrava na
  conferência com cara de dado lido. O que a pessoa não vê no papel não entra.
- **Livro não é ficha.** Um PDF com mais de 100 páginas não é lido — antes a varredura lia as 100
  primeiras, e os livros de regras de Pathfinder (322 a 466 páginas) rendiam "campos" tirados da
  prosa, presets de regra ("You take 5d6 damage of the") e um nome de personagem com uma frase
  inteira. Agora a conferência diz "é um livro, não uma ficha" e não traz nada.
- **"enfeebled 4" não é 1d4.** A notação de dado sem quantidade na frente só vale com o `d` colado
  no número e fora de palavra; "2 d 6" com a quantidade continua lendo.
- **Nome de personagem não é frase**: um campo "Character Sheet" com duzentos caracteres e ponto
  final não vira nome; e um formulário todo em branco não ganha o nome do arquivo, por mais texto
  impresso que tenha (a oficial da Paizo em branco propunha "RemasterPlayerCoreCharacterSheet Form
  Fillable").
- **Preset do texto impresso exige a forma de arma**: nome antes do dado e no máximo uma palavra
  depois ("Espada longa 1d8 cortante"); "2d6 bludgeoning" e "every 1d20 minutes" ficam de fora.

### Mudado

- **As caixas da Ficha abraçam o conteúdo** — pedido do usuário: "se for coisas pequenas, apenas um
  número, não precisa ser um campo grande; se precisa digitar, precisa estar aberto o suficiente
  pra ler". O campo de lista deixou de esticar até encher a fileira (`flex: 0 1 auto`, piso de
  8ch): "3" ocupa o de um "3", e o campo cresce debaixo do dedo conforme se digita
  (`field-sizing: content`). Os blocos de texto continuam abertos como estavam.
- **A foto do crachá da Rolagem cresceu de novo** ("aumenta um pouco mais"): 39×52 → 48×64, e agora
  é a foto que manda na altura do corpo da caixa — o ROLAR estica junto (`align-items: stretch`)
  em vez de a foto caber no que havia.
- **O botão Explode só aparece com perfil de D&D** (`explodeDoSistema.ts`) — pedido do usuário:
  "apenas aparecer quando uma ficha/perfil de D&D for escolhida". O sistema do personagem ativo é
  texto livre, então a conferência é por conteúdo ("D&D 5e", "D & D", "dnd", "Dungeons & Dragons",
  em qualquer caixa). Esconder também desliga o interruptor: explode ligado atrás de um botão
  invisível rolaria diferente do que a tela mostra. Preset com regra explosiva (e o `!` da
  gramática) continua explodindo em qualquer sistema — regra gravada rola como está escrita —, e a
  caixa "Dados explosivos" do editor continua lá. Outro sistema que use explosão como regra central
  entra na lista no dia em que for pedido.
- **O d20 vermelho do Reroll** (`IconeReroll.tsx`) **entrou no botão Explode, na marca de explosão
  do histórico, nos botões de rolar da ficha e no ícone padrão dos presets** (o emoji que a pessoa
  escolhe num preset continua sendo dela). O lápis de editar virou desenho (SVG), como a engrenagem
  já era. As opções de tema e de modo de resultado perderam o emoji do texto. As ABAS tinham
  entrado nessa leva e voltaram atrás a pedido do usuário — "os emojis de estilo/ficha/anotações
  você mantém, eu queria apenas os dados da ficha": 🎨 Estilo, 📜 Ficha (beta) e 📝 Anotações
  seguem com os emojis deles.
- **As caixas da Ficha crescem com o que está escrito.** Pedido do usuário depois de olhar a ficha
  do Rilver: o rótulo ("Conhecimento (Warfare)") e o valor ("+7 · 1d8 P — 10 arrows. 60 ft.")
  aparecem inteiros; os quadros de atributo têm 96px de piso e o conteúdo como medida; os blocos de
  texto (habilidades, inventário, história) crescem a partir de ~9 linhas em vez de rolar por dentro.
  Medido nas três fichas reais: nenhum rótulo ou valor cortado.

## [1.1.0-beta.1] — 2026-08-24

Começa o BETA — entregue À MÃO a alguns testadores, sem publicação no GitHub: quem está no 1.0.12
não recebe esta versão pelo atualizador. O alfa fechou no 1.0.12; o que muda de fase é a
importação de ficha em PDF, que volta à interface marcada como beta, e a base pra ela crescer
segundo o spec de importação (`AGENT_SPEC_pdf-import.md`): validação do arquivo, leitura, modelos
por sistema, geração de presets e a tela de conferência — cada etapa um módulo puro com os próprios
testes.

### Adicionado

- **A aba Ficha volta, como "📜 Ficha (beta)".** Com o botão de importar PDF e a tela de
  conferência, e com o que foi consertado desde que ela saiu: os pares atual/máximo vêm inteiros
  mesmo com metade em branco; toda ficha com dono traz o esqueleto de lacunas (tudo o que é
  preenchível, mesmo vazio); Oblívio traz Aspectos e Equipamento; ritual e item preenchidos entram
  uma vez só; modelo em branco não ganha o nome do arquivo como personagem; teto de campos,
  fragmentos, páginas e tamanho por PDF; assinatura `%PDF-` conferida antes de atravessar o IPC.
- **A gramática de rolagem** (`shared/dice/formula.ts`) — item 1 da ordem de construção do spec,
  "uma notação só pra tudo o que rola": `1d20+5`, `4d6kh3`, `2d20kl1`, `4d6dl1`, `1d6!`, `2d6r<2`,
  `6d6#>=5`, `d%`, `(1d8+2)*2`, `@STR.mod`, e um alvo no fim (`>= 15`). Módulo puro: leitura com a
  posição do erro, avaliação com fonte de dados injetada, ida-e-volta em texto — 44 testes.
- **O campo "Fórmula" no editor de preset.** Escrever preenche os botões; os botões reescrevem o
  texto. O que o rolador desta versão ainda não faz (rerolar, contar sucessos, alvo, referência à
  ficha, multiplicação, manter por grupo) fica escrito com o motivo, em vez de virar um preset que
  rola diferente do que está escrito.

- **A quinta leva de PDFs de teste: mais quinze fichas fabricadas** (`testes/quintaLevaDePdfs.ts`),
  cobrindo o que o beta acrescentou e o adversarial do spec — Ordem em duas páginas com ritual e item
  preenchidos, só os valores atuais, D&D de nível alto com duas armas e conjuração, D&D em branco,
  Oblívio com dois equipamentos, Cthulhu datilografado, Tormenta20 em português, campo de lista e de
  rádio, valor com espaço e quebra de linha, 101 páginas, 5.001 campos, JavaScript embutido, `xref`
  errada e arquivo cortado no meio. `ESCREVER_PDFS=1 npx vitest run corpusDePdfs` escreve os trinta.
  Dois defeitos que ela achou, consertados:
  - a linha de arma com mais de 28 caracteres ("Espingarda calibre 12  dano 2d6+4") não virava
    preset — agora passa quando o dado FECHA a linha, que é a forma de arma e não a de regra;
  - o rótulo impresso de uma caixa ALTA (a história do personagem) ficava de fora, porque a distância
    era medida do centro da caixa — agora é da borda, e a régua é uma só pros dois lugares que mediam;
  - o TÍTULO impresso da ficha ("KIDS ON BIKES / CHARACTER SHEET") era proposto como nome do
    personagem numa arte achatada — visto na importação pela tela, com os quinze PDFs passando pelo
    botão "Importar ficha (PDF)" de verdade;
  - o teto de 2.000 campos por seção era cortado CALADO na gravação: a conferência mostrava 5.000 e o
    disco recebia 2.000. Agora a conferência diz quantos ficam de fora, e o número é um só nos dois lados.

### Mudado

- **O seletor de personagem fica só na Ficha.** Nas Anotações e na Rolagem entra um crachá do
  personagem ativo — foto 3×4 e nome (na Rolagem, da altura do botão ROLAR) —, só de leitura: a troca acontece num lugar só, e as
  outras abas lembram de quem se trata. (O seletor tinha entrado nas Anotações no 1.0.12, quando a
  Ficha estava fora da interface.)

### Conhecido nesta beta

- A bandeja ainda não rola tudo o que a gramática lê: rerolar (`r<2`), contar sucessos (`#>=5`),
  alvo no fim (`>= 15`) e referência à ficha (`@STR.mod`) são recusados no editor de preset, com o
  motivo escrito, em vez de rolarem.
- A tela de conferência ainda não marca campo de confiança baixa ("confira estes") nem mostra o PDF
  ao lado — é olhar a lista e comparar com a ficha.
- O histórico de rolagens é da sessão do app, não do personagem, e some ao fechar.
- As mensagens da gramática de rolagem saem em português também na interface em inglês.
- Ficha que é IMAGEM sem camada de texto (digitalizada, foto) não rende nada — não há OCR. Numa arte
  com anotação por cima, o nome sai como está escrito nela (minúsculas inclusive).

### Para quem testa

- O instalador é `Reroll-Setup-1.1.0-beta.1.exe`, entregue junto do SHA-256 dele. Antes de
  instalar: `Get-FileHash .\Reroll-Setup-1.1.0-beta.1.exe -Algorithm SHA256` e compare.
- Vale tentar: importar a SUA ficha (aba Ficha → "Importar ficha (PDF)") e conferir campo a campo na
  tela de conferência antes de criar o personagem; trocar de personagem na Ficha e ver o crachá
  acompanhar nas Anotações e na Rolagem; criar um preset pelo campo Fórmula (`4d6kh3 + 2`); anotar
  sessões, fechar e abrir o app.
- Achou problema? Anote o sistema da ficha, o que a conferência mostrou e o que esperava — e, se
  puder, mande o PDF junto.

## [1.0.12] — 2026-08-23

**Última versão da fase alfa.** Uma rodada de testes que virou conserto: o d100 não era um dado honesto, o vidro apagava os
números, a engrenagem sumia no modo dia, a palavra TOTAL sumia no painel, a ponte levadiça podia
acabar no caminho dos dados e três botões do editor de preset faziam a coisa errada.

> **A importação de ficha em PDF continua fora da interface.** Ela chegou a entrar marcada como
> beta e voltou a sair na mesma rodada de testes: o que o leitor traz está certo — conferido campo
> a campo contra as fichas reais —, mas ele ainda deixa informação de fora, como os valores ATUAIS
> de PV, PE e Sanidade. Ficha importada pela metade é pior que ficha em branco, porque quem confia
> no que está na tela não confere o que ficou faltando. O código todo continua no repositório e
> coberto por testes; o que está desligado é a porta de entrada.

### Corrigido

- **O d100 agora é um dado honesto.** Ele tirava treze dos cem números NUNCA — não "raramente":
  em 3000 rolagens medidas, treze faces não saíram uma única vez, enquanto a mais sortuda saía
  quatro vezes mais que o esperado. A culpa era da forma: as facetas irregulares de um corpo quase
  esférico apoiam de jeitos diferentes, e algumas simplesmente tombam pra vizinha antes de o dado
  parar. É o mesmo motivo pelo qual o d100 esférico de plástico, na vida real, é conhecido por não
  ser confiável. O dado foi refeito a partir das cem DIREÇÕES que as faces olham, em cinquenta pares
  opostos — faces paralelas duas a duas e somando 101, como manda qualquer dado de verdade. Agora
  todas as cem saem, e a distribuição passa no teste de honestidade junto com os outros seis. De
  quebra, ele precisa de bem menos "cutucada" pra decidir a face: 55 em 3000 rolagens, contra 367.
- **O acabamento de vidro apagava os números.** Medido nas 45 paletas × 4 acabamentos × 7 dados
  (render de verdade, comparando cada dado com ele mesmo pintado sem número pra isolar a tinta): no
  vidro, 237 das 315 combinações ficavam abaixo do limiar de leitura, contra 3 no fosco. Não era
  cor, era o material — 55% de opacidade misturava o número com o fundo. Agora são 80%, escolhido
  olhando os renders lado a lado: o dado continua translúcido e o número volta a aparecer.
- **A palavra "TOTAL" sumia no painel do resultado.** O rótulo era pintado com a COR DO DADO
  escolhida nas Preferências — casava com a mesa, mas fazia a legibilidade depender de uma escolha
  de gosto feita em outra tela. Com dado escuro e fundo preto, saía preto no quase-preto: contraste
  1,1, onde 1,0 é invisível. Agora o texto do painel é branco fixo (contraste 14,4), e a cor
  escolhida continua mandando na borda e no brilho.
- **A engrenagem das Preferências some no modo dia.** O ⚙️ é um bitmap colorido do Segoe UI Emoji,
  prata claro: contraste 1,02 contra o cinza da barra. Emoji colorido não aceita cor, então não
  havia como escurecê-lo. Agora a engrenagem é desenhada e herda a cor do texto: preta no dia
  (contraste 11,5) e clara na noite (9,2). De quebra fica mais 98 — aquele Windows não tinha emoji.
- **A ponte levadiça não fica mais no caminho da rolagem.** Fechar a ponte na Torre de enfeite e
  depois trocar pro modo em que os dados saem pela torre deixava a folha em pé bem na boca — e sem
  jeito de abrir, porque naquele modo o clique na ponte é ignorado de propósito. Os dados saíam
  atravessando a madeira. Agora a ponte só fica fechada no enfeite; ao voltar pra lá, ela está como
  você deixou.
- **Três defeitos nos botões do editor de preset**, todos encontrados clicando um por um:
  - o "+" da quantidade ia até 100 por grupo, num app que rola 20 dados: dava pra subir clicando,
    ver o aviso vermelho e só então descobrir que o Salvar tinha desligado. Agora ele para no teto;
  - o "−" de "quantos contam" ficava clicável sem efeito visível: o mostrador era limitado e o
    valor guardado não, então os primeiros cliques não mudavam nada na tela;
  - e o pior: salvar depois de reduzir os dados **perdia a regra de manter em silêncio**. A tela
    dizia "os maiores"; o preset gravado somava tudo.

### Interno

- A matriz de rolagens virou teste: cada formato de bandeja × cada tipo de lançamento (bandeja e
  boca da torre) × cada tipo de dado, sempre com os 20 do teto e duas rolagens seguidas, mais um
  saco misto dos sete tipos. Aleatoriedade intacta — nada de semente fixa —, e quando falha, o teste
  despeja posição e velocidade do dado em vez de só dizer "18 de 20". 15 rodadas, zero falhas.
- Teste de honestidade com a bandeja cheia, por tipo e por lançamento: metade dos vinte dados
  assenta apoiada noutro dado ou na parede, e nenhum teste via isso antes. O corte do qui-quadrado
  passou a ser seis sigmas da própria distribuição, e não a tabela de alpha — com quatorze casos por
  rodada, a tabela dava 1,4% de vermelho por rodada mesmo com todo dado honesto.
- Varredura de todos os botões do app no Electron: 160 botões distintos nas quatro telas, mais nove
  modais por dentro. Zero erro de página e zero modal travada.
- Quinze personagens de quinze sistemas como material de teste (`scripts/quinzePerfis.mjs`), que é o
  teto de personagens do app com ficha de verdade dentro — e que já achou dois defeitos: o bloco
  vazio de "Atributos" duplicando nos sistemas que chamam a mesma coisa de "Características" ou
  "Estatísticas", e a mistura de Atributos com Aspectos no leitor de Oblivio.
- 895 testes (eram 759).

Revisão de segurança do app inteiro, com o que foi MEDIDO e não suposto.

### Segurança

- **O `Reroll.exe` deixa de ser um Node.js disfarçado.** Medido no instalado:
  `ELECTRON_RUN_AS_NODE=1 Reroll.exe -e "..."` executava qualquer script com a cara do app — o
  truque clássico pra passar por lista branca de antivírus, num app que já foi confundido com
  malware uma vez. Os fuses do Electron agora são gravados no binário no empacotamento: `runAsNode`,
  `NODE_OPTIONS` e `--inspect` desligados, carregamento só de dentro do `app.asar`. A validação de
  integridade do asar ficou de fora de propósito — ela quebraria a entrega que copia só o `app.asar`
  por cima da instalação; volta quando o executável for assinado.
- **As anotações passam a ser conferidas ao gravar.** Era o único canal que escrevia no disco
  exatamente o que a tela mandava, sem normalizar nem limitar — e grava a cada tecla. Agora normaliza
  antes de gravar e recusa, com aviso na tela, o que passar de 16 MB; o que estava no disco continua
  intacto.
- **A foto do personagem só entra se for imagem embutida (PNG/JPEG/WebP) e do tamanho que o seletor
  aceitaria.** O seletor tinha teto de 12 MB; o canal de gravação e o `profiles.json` não tinham
  nenhum, e a foto é lida inteira em toda abertura do app. Nome e sistema ganham o mesmo teto de 200
  caracteres da importação de ficha.
- **A importação de presets tem teto: 2 MB de arquivo e 500 presets por vez.** O PDF e a imagem já
  tinham limite; o `.json` era lido inteiro e analisado fosse do tamanho que fosse. Lista maior que
  o teto é recusada dizendo quantos tem — não importa os primeiros quinhentos calado.

- **A varredura do PDF ganha teto de campos (5 mil) e de fragmentos de texto (50 mil).** Bytes e
  páginas já tinham teto; campos e textos não — e é neles que os leitores fazem conta campo × texto.
  Uma página só com cinco mil campos e duzentos mil fragmentos cabe em poucos megabytes e congelava
  a interface inteira sem botão de cancelar. A maior ficha real tem 458 campos e 886 fragmentos.

### Mudado

- **O leitor de D&D 5e também traz as lacunas.** O de Ordem Paranormal já trazia o esqueleto inteiro
  (perícias, rituais, itens) em ficha com dono; o de D&D descartava tudo o que estivesse em branco, e
  uma ficha de nível 1 chegava com três perícias e nenhum lugar pra anotar a quarta. Agora as dezoito
  perícias, as seis salvaguardas, o combate e a página de magia vêm inteiros — vazios onde a ficha
  está vazia — quando há nome de personagem. O modelo em branco continua enxuto.
- **Quarta leva de personagens de teste (`scripts/quartaLeva.mjs`): ficha completa e FOTO em todos**,
  nos três formatos que a fronteira aceita. Conferido no app: as quinze fotos aparecem no seletor,
  as sessões de cada um continuam iguais depois de passar por todos, e trocar a cor do dado em dois
  não vaza pros outros treze.

### Corrigido (revisão de código do 1.0.12)

Dez achados da revisão automática, três deles consequência dos consertos de segurança acima:

- **A importação de ficha voltou a ser tudo-ou-nada.** O teto das anotações podia estourar DEPOIS
  de o personagem ter sido criado e aberto, deixando um personagem novo e vazio com um erro na tela.
  A falha agora desfaz o perfil.
- **O teto de presets mudou de lugar: 2.000 por personagem, cobrado no repositório** — onde o
  editor, a importação de arquivo e a importação de ficha se encontram. O teto anterior (500 por
  importação) quebrava o ciclo do próprio app: exportar 600 presets e não conseguir importar o
  backup. Tudo o que o app exporta ele importa de volta. Nome e ícone de preset ganham teto também.
- **Ritual ou item preenchido entrava duas vezes na ficha de Ordem Paranormal** — como "RITUAIS 1"
  pelo leitor genérico e como "Ritual 1" pela lacuna. Os testes só cobriam a ficha em branco.
- **Formulário em branco sem texto impresso não ganha mais o nome do arquivo como personagem.** A
  regra anterior só cobria a arte achatada; um modelo preenchível com cinquenta campos vazios passava
  pelo buraco. E a regra de "leu alguma coisa" virou uma função só pros dois caminhos do genérico,
  que tinham fórmulas diferentes.
- **Regra de manter sem efeito não vira regra de verdade ao salvar.** "Usar os 3 maiores" de 3 dados
  (ou `count` zero num arquivo editado à mão) abria no editor como "2 maiores", e renomear o preset
  gravava isso. Agora abre como "todos os dados", que é o que ela sempre foi.
- O teto das anotações passa a medir o arquivo como ele vai pro disco (com indentação); a foto do
  personagem é validada pelo prefixo em vez de varrer 17 MB de base64 a cada tecla no nome; e a
  regra de "rótulo escrito pela pessoa" deixou de existir em cópia dupla.
- **Um `.pdf` que não começa com `%PDF-` é recusado antes de atravessar o IPC** (Stage 0 do spec de
  importação): vídeo renomeado, executável, zip.

O que foi conferido e está certo, pra não ser reconferido: sandbox, isolamento de contexto e Node
desligados no renderer; CSP sem `unsafe-eval`; permissões todas negadas; rede só pro caminho da
atualização (GitHub, HTTPS); navegação e `webview` bloqueados; menu e DevTools fora da versão
instalada; id de personagem saneado antes de virar pasta; nenhum processo externo; `npm audit` sem
vulnerabilidade; e o pdf.js 6.2 já não tem o caminho de `eval` da CVE-2024-4367.

O que fica como recomendação, e não como conserto: **assinar o executável** antes de distribuir
mais largamente. Sem assinatura, a atualização automática confia só no HTTPS do GitHub — quem
tomar a conta publica uma "atualização" que roda em todo mundo.

## [1.0.11] — 2026-08-23

Coisas da mesa: o estojo arrumado, a ponte da torre que abre e fecha, a câmera mais rápida e a
liberdade de tirar todos os dados da rolagem.

### Adicionado

- **A ponte levadiça da torre abre e fecha com um clique nela**, na cena mesmo — só na **Torre de
  enfeite**. No modo em que os dados saem pela torre ela continua firme no lugar, e não é
  frescura: ali o dado passa por cima do tabuleiro, então uma ponte levantada seria uma parede no
  meio da rolagem, descoberta no meio da partida. Fechada, a folha sobe entre os pilares do portão
  e tampa o vão; as correntes encurtam junto, como corrente de verdade.
- **Dá pra ficar sem dado nenhum.** O ✕ agora aparece também no último tipo da lista — antes ele
  sumia justamente quando fazia mais falta: pra trocar 3d6 por 1d20 era preciso ir tirando um a um
  até sobrar um, e só então escolher outro. Com a rolagem vazia, o **ROLAR desliga** e diz o
  porquê, e o Espaço/Enter também não rolam nada.

### Mudado

- **Os dados do estojo mostram o maior número, virado pra quem olha**: d4 com 4, d6 com 6, d20 com
  20, d100 com 100. Cada um exibia a face que calhasse — que não era escolha, era o que sobrava de
  como o modelo foi desenhado. O d4 é o de sempre a exceção, e por motivo de dado: nele o número
  fica no vértice de cima, não numa face.
- **A câmera do W/A/S/D anda no dobro da velocidade.** Medido contra o tamanho da cena, não no
  olho: o zoom inteiro cai de 3,7s para 1,7s, a volta completa em torno da bandeja de 3,9s para
  2,0s, e atravessar a mesa de 3,6s para 1,6s. A régua é uma travessia de ponta a ponta custando
  uns dois segundos de tecla apertada.

### Interno

- 759 testes (eram 719).

## [1.0.10] — 2026-08-22

A primeira leva depois do fechamento do alfa: duas fontes pedidas, as anotações reorganizadas em
lista de sessões e o dado da aba Estilo, que não aparecia.

### Adicionado

- **Sweetie e Algerian no menu de fontes**, que vai de doze para catorze. Nenhuma das duas é
  empacotada com o app, e o motivo é a licença: a Sweetie é gratuita só para uso pessoal e a
  Algerian é comercial — pôr o arquivo dentro de um app publicado no GitHub seria redistribuição.
  O que entra é o nome da família. Quem as tiver instaladas no Windows as vê; quem não tiver cai
  num reserva escolhido para se parecer com ela e que **não** é opção do próprio menu (Segoe Script
  para a Sweetie, Arial Black para a Algerian), porque cair numa fonte da lista faz escolher uma e
  receber outra.
- **A data de criação de cada sessão de anotações**, que não existia em lugar nenhum. As sessões
  escritas antes desta versão aparecem como **sem data** — em vez de carimbar a data de hoje numa
  anotação de três meses atrás, que seria uma informação errada sem ninguém ter como desconfiar.

### Mudado

- **As anotações viraram uma lista de sessões**, com a navegação numa coluna à esquerda e o texto à
  direita. Saíram as setas ◀ ▶, o contador "3/20" e o seletor de salto: os três existiam para o
  mesmo problema, e chegar na terceira de vinte sessões era escolher entre dezessete cliques na
  seta ou um seletor que mostra um nome por vez. A moldura continua Windows 98.
- **A Comic Sans não diz mais "(p/ dislexia)" no rótulo.** A fonte continua na lista, e continua
  sendo a opção que cobre leitura com dislexia desde que a OpenDyslexic saiu na poda das dezoito
  para doze — o que mudou foi só o nome na tela.
- Créditos: a Sweetie aparece como **by vivi** e a Algerian como **by pedro**.

### Corrigido

- **O dado da aba Estilo não aparecia** até alguém mexer numa cor. A bandeja pintava e o dado não,
  e ele surgia assim que se trocava uma cor, um acabamento ou o tipo — o que fazia o defeito
  parecer intermitente. Era ordem de montagem, não desenho: na 1.0.9 a cena passou a ser criada
  dois quadros depois, para a aba pintar antes, e a partir daí quem cria a malha do dado sempre
  encontrava a cena ainda vazia na primeira passagem, sem ter por que tentar de novo.

### Interno

- 693 testes (eram 689).

## [1.0.9] — 2026-08-21

O fechamento do alfa: o app inteiro conferido contra a especificação, dois defeitos sérios
corrigidos, e a base de segurança e de release montada para o beta.

> **Sobre o número da versão.** O app vinha marcado como `0.1.x-alpha` enquanto a especificação já o
> chamava de 1.0.x. Os dois passam a dizer a mesma coisa a partir daqui.

> **A aba Ficha não entra nesta versão.** O alfa fecha com três abas — Rolagem, Estilo e
> Anotações —, que são as que estão prontas de verdade. A importação de ficha em PDF continua
> escrita e testada no repositório, só não tem entrada na interface: ela lê bem as fichas que
> conhece e ainda erra nas que não conhece, e uma ficha lida errado é o nome, os atributos e a
> história de um personagem de alguém saindo trocados. Volta pelo beta, quando acertar sozinha.

### Adicionado

- **Até 15 personagens.** A spec pedia dez como mínimo garantido; o teto ficou em quinze, que cobre
  quem joga em três ou quatro mesas ao mesmo tempo. Cada um carrega o diário, os presets e a
  aparência dele. No limite, o botão de criar fica travado e explica por quê — e um arquivo que já
  tenha mais que quinze não perde ninguém, porque o teto vale na criação, nunca na leitura.
- **Até 20 dados por rolagem** (era 15). Medido antes de subir: 100% de assentamento e zero dados
  escapando da bandeja em 15/18/20/22 dados, nas quatro formas de bandeja, e com a distribuição das
  faces observadas entre 15,4% e 17,5% (o esperado é 16,7%) — ou seja, a física continua justa com a
  bandeja cheia.
- **Dados explosivos.** Dado que tira o valor máximo volta pra bandeja e cai de novo; as quedas
  somam. Liga e desliga por rolagem, ao lado de vantagem/desvantagem, e também pode ficar gravado
  num preset. Cada dado explode por conta própria, com teto de dez quedas encadeadas.
- **Modo de resultado rápido.** Em Preferências, escolha entre a bandeja 3D e só o número. Numa
  máquina que não consegue desenhar a cena 3D, o app entra nesse modo sozinho e explica por quê —
  antes disso, não havia como rolar dado nessas máquinas.
- **Tema seguindo o Windows.** O botão de tema agora cicla Dia → Noite → Sistema. Quem escolher
  "Sistema" acompanha o Windows na hora em que ele mudar, sem reabrir o app.
- **Changelog na hora de atualizar.** O aviso de versão nova mostra o que mudou, e não só o número.

### Mudado

- **A lista de fontes encolheu de dezoito para doze.** Saíram MS Sans Serif, Verdana, Trebuchet,
  Candara, Georgia, Palatino, Consolas e OpenDyslexic — a maioria era variação quase indistinguível
  do que ficou, e um menu mais curto é mais fácil de escolher. Quem tinha uma das removidas
  selecionada cai na fonte padrão na próxima abertura, sem erro.
- **A Comic Sans passou a dizer que é a opção para dislexia.** Ela já estava na lista e já é
  recomendada para isso; o que faltava era a tela dizer, para quem precisa da opção conseguir
  encontrá-la.
- Créditos: os ícones agora aparecem como **@tweetsdoxuga**, e a Times New Roman como **by avigro**.
- **Versões de dependência fixadas** no `package.json`, sem faixas `^`. Num app distribuído sem
  assinatura digital, o build reproduzível é metade do argumento de confiança.

### Desempenho

Medido no app instalado, com as métricas do próprio Chromium, antes e depois. O tempo de CPU gasto
pela interface a cada 4 segundos:

| Aba | Antes | Agora |
| --- | --- | --- |
| Rolagem (parada) | 278–310 ms | **138–176 ms** |
| Estilo | 89 ms | **28 ms** |
| Anotações | 48 ms | **14 ms** |
| Trocar para Estilo | 71,6 ms até pintar | **43,3 ms** |

Três causas, todas encontradas medindo:

- **A cena 3D rodava escondida.** A aba de Rolagem nunca é desmontada — ela some com `display:
  none`. O desenho já era pulado, mas o resto do quadro rodava igual: física, câmera, bandeira,
  respiração da pelúcia, 165 vezes por segundo atrás de uma tela que ninguém está vendo. Era isso
  competindo com o resto da interface em todas as outras abas.
- **A física rodava com tudo parado.** Agora só roda quando há dado se mexendo — e continua rodando
  com a aba escondida nesse caso, para quem rola, troca de aba e volta encontrar o resultado pronto.
- **As sombras eram recalculadas a cada quadro**, mesmo com a cena imóvel. Passaram a ser refeitas
  sob demanda, com uma última atualização quando o último dado assenta.

As prévias 3D da aba Estilo passaram a ser montadas depois da primeira pintura, para a aba aparecer
antes de os dois renderizadores serem criados.

### Corrigido

- **Não dava para digitar modificador NEGATIVO** — em lugar nenhum. O campo era numérico e guardava
  o valor já convertido: digitar o sinal de menos virava zero na mesma tecla, e o traço sumia antes
  de dar tempo de escrever o algarismo. Num app de RPG isso é meio caminho perdido — metade das
  rolagens de RPG tem penalidade, e não dava para salvar um preset de arma amaldiçoada.
  O campo existia copiado em **três** telas (barra de rolagem, editor de presets e modo compacto),
  as três com o mesmo defeito. Agora a regra mora num lugar só: o campo guarda texto, aceita "-2"
  digitado à mão, e as setinhas do navegador deram lugar a botões **−** e **+**, que dizem o que
  fazem e são clicáveis mesmo na janela compacta.
- **A rolagem podia passar do limite de dados.** Cliques rápidos no "+" chegavam a 31 dados num app
  cujo teto é 20: a checagem lia a lista do render anterior, e o React agrupa cliques rápidos num
  lote só, onde todos enxergam o mesmo valor velho. A conta passou para dentro da atualização de
  estado, onde a lista é a mais recente.
- **Personagens sumindo da lista.** A lista de personagens podia ser gravada por cima da real ANTES
  de ser lida do disco, o que substituía o índice inteiro por um personagem em branco. Os dados nunca
  eram apagados — as pastas continuavam em `%APPDATA%\Reroll\profiles\` —, mas não apareciam mais no
  app. Numa instalação de teste isso deixou quatorze personagens no disco e um só na lista. Agora a
  lista não pode ser gravada antes de ser lida, e há teste que falha sem essa garantia.
  A pasta de um personagem continua nunca sendo apagada, nem quando ele sai da lista: se algum dia o
  índice se perder de novo, os dados estão lá para serem devolvidos à mão.
- **As anotações e o "criar outro dia" pareciam não funcionar.** Era o mesmo defeito acima visto de
  outro ângulo: o diário era escrito na pasta de um personagem que a lista já tinha esquecido.
- **`1d6+10d6` não era entendido.** Quantidade de dois dígitos depois do `+` era lida como
  modificador, e a expressão inteira era recusada — enquanto `10d6+1d6`, a mesma rolagem escrita ao
  contrário, funcionava. Ficava escondido porque com o teto antigo de 15 dados dois dígitos quase
  nunca cabiam.
- **O DevTools estava acessível na versão instalada.** A janela não tem moldura, então o menu padrão
  do Electron era invisível — mas os atalhos funcionavam: `Ctrl+Shift+I` abria o inspetor, `Ctrl+R`
  recarregava a página no meio da partida (apagando o histórico de rolagens) e `Ctrl+W` fechava a
  janela. O menu foi removido da versão empacotada.
- **Os seletores de arquivo esqueciam a pasta.** Regressão da atualização do Electron, que passou a
  abrir todo diálogo em Downloads. O app agora lembra a última pasta de cada tipo — imagem e
  presets, cada uma na sua.
- **Exportar presets falhava em silêncio.** Sem permissão na pasta, ou com o disco cheio, o clique
  não fazia nada. Agora explica.
- **Escolher a foto do personagem falhava em silêncio** pelo mesmo motivo, e agora tem limite de
  tamanho (12 MB): uma foto muito grande deixava o app lento na abertura, sem nada indicando a causa.
- **O app podia não abrir sem dizer nada.** Uma falha ao ler a pasta de dados na inicialização
  deixava o processo vivo, sem janela e sem erro. Agora mostra o que houve e sai.
- Presets ilegíveis deixavam a lista presa em "carregando" para sempre.

### Segurança

- **Electron 33 → 43** (Chromium 130 → 150). A versão anterior estava sem suporte havia meses, com
  sete avisos de segurança publicados e o navegador embutido sem correções. Junto vieram
  electron-builder 26 e Vite 7. `npm audit` passou de 17 vulnerabilidades para zero.
- Travas de navegação passaram a valer para o app inteiro, e não só para a janela principal — uma
  janela criada no futuro nasce protegida em vez de nascer aberta.
- Limite de tamanho para as imagens (12 MB), que faltava.
- `Content-Security-Policy` fechou `base-uri` e `form-action`.

### Interno

- Testes de justiça estatística do sorteio de dados (qui-quadrado por tipo de dado, com semente fixa
  para nunca falharem sozinhos) e verificação direta da amostragem por rejeição.
- ESLint, que não existia — havia comentários `eslint-disable` escritos para um linter nunca
  instalado.
- Conferência automática (GitHub Actions) em todo commit: tipos, análise estática, testes e
  auditoria de dependências, com o build falhando em achado alto ou crítico.
- Instalador publicado por CI a partir de commit etiquetado, com SHA-256 ao lado.
- 689 testes.

---

As versões anteriores a esta não têm registro escrito. O histórico do repositório e as páginas de
release do GitHub são o que existe delas.
