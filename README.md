# Reroll

App desktop de rolagem de dados para RPG. Funciona 100% offline, com presets de ataque/magia salvos
localmente no seu computador. Feito com Electron + React + TypeScript.

Licença: [MIT](LICENSE). Créditos de fontes e arte de terceiros: [NOTICE.md](NOTICE.md).
Histórico de versões: [CHANGELOG.md](CHANGELOG.md). Quer contribuir? [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacidade — o que o Reroll faz com os seus dados

Nada sai do seu computador. Isso não é uma promessa de boa vontade; está **imposto em código**, e dá
para conferir:

- **Nenhuma requisição de rede**, exceto uma pergunta ao GitHub sobre versão nova (e o download do
  instalador, se você mandar atualizar). Qualquer outro destino é bloqueado na sessão do Electron,
  antes de a conexão sair da máquina — ver a lista branca em
  [`src/main/seguranca.ts`](src/main/seguranca.ts).
- **Nenhuma permissão do sistema é pedida**: câmera, microfone, localização, notificação, área de
  transferência. Todas negadas por padrão, no mesmo arquivo.
- **Nenhuma telemetria, nenhuma conta, nenhum cadastro.** O app não sabe quem você é.
- **Seus dados ficam em `%APPDATA%\Reroll`** — presets, anotações, personagens e preferências, em
  arquivos JSON que você pode abrir, copiar e levar embora.
- A instalação é **por usuário** e **não pede administrador**.

## Baixando e conferindo o instalador

O Reroll **não tem certificado de assinatura digital** (eles custam caro para um projeto pessoal),
então o Windows mostra um aviso do SmartScreen na primeira execução: clique em **Mais informações →
Executar assim mesmo**.

No lugar do certificado, o que existe é verificável:

1. o código é aberto e está todo aqui;
2. o instalador é construído pelo **GitHub Actions**, a partir do commit etiquetado — não pela
   máquina de ninguém (ver [`.github/workflows/release.yml`](.github/workflows/release.yml));
3. o **SHA-256** de cada instalador é publicado junto na página da release.

Para conferir o arquivo que você baixou, no PowerShell:

```powershell
Get-FileHash .\Reroll-Setup-1.0.11.exe -Algorithm SHA256
```

O resultado tem que bater com a linha correspondente em `SHA256SUMS.txt`, anexado na mesma release.
Se bater, o arquivo é exatamente o que saiu do build público.

## Rodando em modo desenvolvimento

Pré-requisito: [Node.js](https://nodejs.org) instalado (v18+).

```bash
npm install
npm run dev
```

Isso abre a janela do app com hot-reload — qualquer alteração no código da interface aparece na hora.

## Verificando tipos

```bash
npm run typecheck
```

## Gerando uma versão distribuível (Windows)

### Opção 1 — pasta/zip portátil (sempre funciona, recomendado por agora)

```bash
npm run build
npm run dist:win
```

Mesmo que a etapa do instalador `.exe` único falhe (ver observação abaixo), a pasta
`release/win-unpacked/` já contém o app completo e funcional — é só compactar e enviar:

```bash
Compress-Archive -Path .\release\win-unpacked\* -DestinationPath .\release\RoladorDeDados-win-x64.zip
```

Seus amigos baixam o `.zip`, extraem em qualquer pasta e executam `Reroll.exe`. Não
precisa instalar nada — nem depende de internet.

### Opção 2 — instalador `.exe` único (NSIS)

O `electron-builder` também pode gerar um instalador tradicional (com atalho na área de
trabalho e no menu iniciar). Para isso ele baixa uma ferramenta de assinatura de código que
contém *symlinks* — e o Windows só permite criar symlinks sem privilégio de administrador se o
**Modo de Desenvolvedor** estiver ativado (`Configurações → Sistema → Área de desenvolvedores`).

Com o Modo de Desenvolvedor ativado, rode:

```bash
npm run dist:win
```

O instalador final fica em `release/Reroll Setup <versão>.exe`.

## Visual

A interface usa um tema retrô estilo Windows 98 (janela sem moldura nativa, com barra de
título, toolbar e status bar próprios), com alternância dia/noite e seletor de fonte — ambos
salvos no `localStorage` do navegador embutido, então a preferência persiste entre reinícios.

Pra trocar o ícone do app (atualmente um dado d20 gerado em `scripts/generate-icon.mjs`), edite
o SVG nesse script e rode:

```bash
npm run icon:generate
```

Isso regenera `build/icon.ico` e `build/icon.png`, usados tanto na janela quanto no instalador.

## Onde os dados ficam salvos

Os presets são salvos em `presets.json`, dentro da pasta de dados do usuário do Windows:

```
%APPDATA%\reroll\presets.json
```

Cada computador tem seus próprios presets — não há login nem sincronização online. Como é um
arquivo JSON simples, dá pra copiar esse arquivo entre computadores como uma forma manual de
backup/transferência (uma função de exportar/importar pela própria interface é uma evolução
natural disso).

## Estrutura do projeto

```
src/
  shared/     tipos e constantes usados tanto no processo principal quanto na interface
  main/       processo principal do Electron (janela, armazenamento em disco, IPC)
  preload/    ponte segura entre o processo principal e a interface
  renderer/   interface em React (rolagem, presets, histórico)
```

Veja mais detalhes de arquitetura no histórico de conversa do projeto — o código é organizado
para permitir adicionar depois: animações de dados rolando, temas, sons, modificadores,
vantagem/desvantagem, export/import de presets, atalhos de teclado, entre outros.

## Status atual (MVP)

- [x] Rolagem manual (quantidade + tipo de dado: d4, d6, d8, d10, d12, d20, d100)
- [x] Resultado individual de cada dado + soma total
- [x] Histórico da sessão
- [x] Presets: criar, editar, excluir, executar com um clique
- [x] Presets persistem entre reinícios do app
- [x] Tema retrô Windows 98 com alternância dia/noite e seletor de fonte
- [x] Emoji picker curado pros ícones de preset
- [x] Idioma pt-BR/en-US, painel de preferências (⚙️)
- [x] Modificador (+/-) e modo Normal/Vantagem/Desvantagem pra qualquer quantidade de dados
- [x] Par de dados com cor por posição (maior azul, menor vermelho) quando um grupo tem 2 dados
- [x] Cada tipo de dado com cor própria nos chips de resultado
- [ ] Ficha de personagem com importação de PDF — está escrita e testada, mas SEM entrada na
      interface: o que o leitor traz está certo (conferido campo a campo contra as fichas reais de
      Ordem Paranormal e Oblivio), e ele ainda deixa informação de fora — os valores atuais de PV,
      PE e Sanidade, entre outros. Ficha importada pela metade é pior que ficha em branco. Volta
      quando trouxer a ficha inteira.
- [x] Modo compacto (janela mini só com o rolador)
- [x] Limpar histórico
- [x] Som de rolagem, diferente pra 1 dado (`roll-single.mp3`) e pra vários (`roll-many.mp3`),
      com toggle nas preferências
- [x] Imagens ilustrativas de todos os tipos de dado disponíveis (d4/d6/d8/d10/d12/d20/d100)
- [x] Tela de intro com barra de progresso e musiquinha (`assets/sounds/intro.mp3`, ainda placeholder)
- [x] Animações visuais de dados rolando (física real com Rapier + Three.js, Fase 10)
- [x] Modificadores em presets (`2d10 + 5`), além do modificador manual já existente na rolagem
- [x] Export/import de presets (JSON, via diálogo nativo do Windows)
- [x] Atalhos de teclado: Enter/Espaço rola, Esc fecha painéis, Ctrl+N novo preset
- [x] D100 esférico de verdade (100 facetas planas, casco convexo, como o Zocchihedro físico)
      em vez do truque de dois d10 (dezena + unidade) — passa pela mesma física/UI de
      qualquer outro dado, inclusive vantagem/desvantagem e múltiplas unidades
- [x] Customização de cor dos dados 3D: cor do corpo e cor do número, escolhidas na aba
      Estilo, persistidas e aplicadas a todos os tipos de dado (Fase 11)
- [x] Modo debug (só em `npm run dev`, nunca no app empacotado): colisor real de cada dado,
      normais de face melhor/segunda colocada, confiança da leitura, velocidade linear/angular,
      estado de "dormindo" e FPS, tudo sobreposto à cena 3D em tempo real (Seção 25)
- [x] Acabamentos para os dados 3D (aba Estilo): fosco, metálico, plástico e vidro — o metálico
      tem ambiente de reflexo próprio pra não ficar preto/sem vida, mais um conjunto de cores
      metálicas prontas (ouro, prata, bronze, cobre, chumbo, obsidiana)
- [x] Cor de parede e de fundo da bandeja customizáveis (aba Estilo) — substituiu o sistema de
      temas visuais fixos (cerca/floresta/luar) removido a pedido do usuário
- [x] Terceira aba "Estilo" dedicada à personalização visual dos dados e da bandeja, separada
      das Preferências gerais (⚙️) pra não ficar apertado
- [x] Janela padrão maior (1300×800) pra caber toda a interface sem precisar redimensionar
- [x] Parede da bandeja mais alta (5.5) e chão da bandeja com cor customizável (aba Estilo),
      com preset pronto "Couro" (parede escura + chão mostarda, inspirado numa bandeja de couro
      de referência)
- [x] Ícone do app selecionável entre 8 variações coloridas com o logo "R" (Preferências ⚙️) —
      troca de verdade o ícone da janela/barra de tarefas do Windows em tempo real e persiste
      entre reinícios (o ícone do atalho da área de trabalho/instalador só atualiza no próximo
      build empacotado — limitação do Windows, não dá pra reescrever em tempo real)
- [x] Torre de dados com física real (aba Estilo → Modo de lançamento → Torre): rampa em
      espiral dentro de uma torre de castelo, dado desce colidindo de verdade com a rampa
      (não é animação) até sair numa bandeja circular própria na base. Rolagens com vários
      dados descem um de cada vez (mais lento que a bandeja aberta, trade-off deliberado por
      confiabilidade)
- [x] Rolagem manual com múltiplos tipos de dado na mesma jogada (ex.: 1d6 + 1d20), sem
      precisar passar por um preset
- [x] Câmera orbital: arraste o botão do mouse na cena 3D (bandeja ou torre) pra girar/ver de
      qualquer ângulo, inclusive de cima — zoom e ângulo limitados pra não perder a cena de vista
- [x] Ações de um preset (rolar/editar/excluir) ficam desabilitadas enquanto QUALQUER rolagem
      está em andamento, evitando editar/cancelar um preset no meio da própria animação dele
- [x] Torre com cara de castelo de verdade: textura de tijolo procedural na casca (canvas 2D,
      sem imagem externa), ameias no topo da casca e da parede da base, bandeira no mastro —
      uma torre só, sem torreões satélite (testado, removido a pedido do usuário)
- [x] Gravidade mais forte só no modo Torre (não afeta a bandeja aberta) — dados descem a rampa
      mais rápido/pesado
- [x] Bandeja virou hexágono de verdade (parede física + visual, não só a aparência) forrado de
      veludo (sheen + normal map + mapa de sombreado procedurais simulando o "pelo" do tecido,
      visível tanto de perto quanto no enquadramento padrão) — substituiu o formato retangular
- [x] Imagem de fundo customizável na cena 3D (aba Estilo → "Escolher imagem..."), além da cor
      de fundo sólida — PNG/JPG/WEBP escolhido via diálogo nativo, guardado como data URL
- [x] Mais fontes no seletor de Preferências (Arial, Georgia, Impact, Trebuchet MS, Consolas,
      Papyrus, Century Gothic, além das 7 originais)
- [x] Presets de cor "gema" prontos pros dados (aba Estilo), além dos metálicos: ametista,
      granada, safira, ametista noturna, esmeralda, rubi noturno — números dourados
- [x] Chão hexagonal da bandeja liso, sem a lateral/degrau visível de antes (parecia um "tronco"
      solto, sem se misturar ao resto da cena) — collider físico continua com espessura real,
      só o visual virou uma chapa plana
- [x] Janela do splash cresce com animação suave até o tamanho final da janela (em vez de saltar
      de um tamanho pro outro num frame só)
- [x] Torre de dados com gravidade mais forte e rampa mais íngreme (mais peso/velocidade na
      descida)
- [x] Chão "infinito" ao redor da bandeja/base da torre (versão mais escura da cor do piso) —
      a área de jogo agora conecta com um terreno de verdade em vez de flutuar sobre o fundo
- [x] Câmera orbital recentraliza sozinha (com animação suave) em cima de onde os dados
      realmente pousaram depois de assentar, em vez de só orbitar o centro fixo da cena
- [x] Bandeja aberta com arremesso mais forte/rápido (gravidade e impulso maiores), pra parecer
      mais uma pessoa jogando os dados de verdade
- [x] Preview 3D do dado na aba Estilo — mostra como a cor/acabamento escolhidos vão ficar sem
      precisar voltar pra aba Rolagem
- [x] Torre com casca opaca de verdade (era semi-transparente) — só dá pra ver a rampa espiral
      por dentro olhando de cima pela abertura, não mais através da parede lateral; padrão de
      tijolo com mais contraste
- [x] Base da torre virou uma praça hexagonal sem parede própria (era um círculo com parede
      baixa ao redor) — mais coerente com a torre já ser uma estrutura sólida por conta própria
- [x] Corrigido desalinhamento real entre parede/chão/veludo da bandeja hexagonal (a parede
      (`CylinderGeometry`) e o chão nasciam com uma rotação de 90° uma em relação à outra —
      confirmado comparando os vértices das duas geometrias, não só ajustado por tentativa)
- [x] Chão "apron" ao redor da bandeja/torre bem menor (raio 16, era 40) — não cobre mais quase o
      quadro inteiro, deixando o fundo (cor OU imagem escolhida) aparecer como fundo de verdade
- [x] Torre mais baixa e rampa mais rápida (dado desce em ~1-2s na maioria das vezes, medido com
      física real headless, não estimado) — trade-off deliberado: `turns` da espiral caiu de
      0.85 pra 0.35, já que altura e velocidade de descida escalam juntas com esse parâmetro
- [x] Mais opções de cor prontas na aba Estilo: metálicas (6→12), gemas (6→12), e dois grupos
      novos — foscas (6) e plásticas (6)
- [x] Torre com portão de verdade (recorte real na parede, não só decoração por cima) na posição
      exata onde a rampa sai, com uma "mini área de aterrissagem" (soleira de pedra) do lado de
      fora — sem isso o dado parecia atravessar tijolo maciço ao sair, depois da parede virar opaca
- [x] Textura de tijolo da torre ganhou um normal map (argamassa lê como recuada de verdade sob
      luz, não só uma variação de cor plana) — tijolos com mais aparência de pedra de castelo
- [x] Torre mais baixa e rampa ainda mais rápida (~1.5s de mediana, medido com física real) —
      segunda rodada de ajuste depois que "1-2s" virou "2-3s, bem íngreme" mais especificamente
- [x] "Calha de saída" física ligando o fim da rampa ao portão — sem ela o dado perdia a direção
      e boa parte das vezes nem chegava perto da área de aterrissagem; agora a maioria das
      quedas assenta bem perto do portão de verdade (medido, não só ajustado por tentativa)
- [x] Portão de castelo com moldura de pedra (2 pilares + verga) e uma porta de madeira aberta
      encostada na parede ao lado — não só o recorte na parede, uma porta reconhecível
- [x] Chão da base da torre virou piso de pedra ("relevos de tijolos na terra") com normal map,
      em vez de uma cor lisa — mesma técnica da parede, agora também no chão
- [x] Corrigidos dois bugs reais do portão/calha, achados só depois de ver ao vivo: a porta
      "aberta" cortava a própria passagem na diagonal (girada pro ângulo errado); a guia da calha
      era alta o bastante pro dado pousar equilibrado em cima dela e ficar preso ali, parado
- [x] Saída da rampa redireciona a velocidade do dado reto em direção ao portão (em vez de só
      reforçar o que já tinha) — a aterrissagem virou bem mais consistente perto da frente do
      portão, em vez de espalhada em qualquer direção pela sobra de giro da espiral
- [x] Guia contínuo de verdade até a plataforma de aterrissagem (não só um empurrão único na
      saída) — agora o dado assenta do lado de FORA da torre, bem na frente do portão,
      consistentemente (medido: 30/30 numa amostra, era só ~50% antes)
- [x] Torre bem menor de novo e rampa ainda mais íngreme (pedido repetido do usuário) — parede
      mais próxima da rampa, altura reduzida mais uma vez
- [x] Torre mais fina (raio da rampa e da parede reduzidos, ~25% menos de diâmetro)
- [x] Guia até a aterrissagem ficou mais suave/natural (mistura gradual + o dado gira rolando de
      verdade, não só desliza) em vez de "voar" reto até o alvo — e ganhou um limite de tentativas
      pra nunca travar a rolagem pra sempre (achado numa bateria de testes antes de publicar:
      ~20% das quedas ficavam presas indefinidamente sem esse limite)
- [x] Corrigido "as cores não funcionam": a parede da bandeja era desenhada com 35% de opacidade,
      então a cor escolhida em "Cor da parede" saía diluída por cima do chão (um marrom-couro
      escuro virava uma faixa bege). Agora a parede é opaca e só renderiza a face de dentro
      (`BackSide`), o que mantém a bandeja "aberta" pra câmera sem mexer na cor
- [x] Estojo de dados com TAMPA de verdade: começa fechado (envolvendo os dados) e abre sozinho
      numa animação com dobradiça na aresta de trás, revelando um dado de cada tipo
- [x] Mesa de grama: o chão em volta da bandeja virou uma MESA (tampo de grama procedural
      desenhada em canvas, com normal map, + borda de madeira que acompanha a cor de parede
      escolhida), no lugar do disco de cor sólida. A grama é verde fixo de propósito — grama
      tingida de mostarda ou roxo não é grama. Vale pros dois modos, bandeja e torre
      (`createGrassTexture.ts`)
- [x] Interface de volta ao Windows 98 puro, depois de uma passagem por um acabamento "moderno"
      (cantos arredondados, relevo por gradiente+sombra, botão subindo no hover, abas com barra de
      acento, chips em pílula) que destoava do resto da janela — barra de título, painéis, estojo
      de presets e splash sempre foram 98. Voltaram: degrau `outset` de 2px solto e `inset`
      afundado no clique (com o rótulo andando 1px, como no original), campos rebaixados,
      retângulo pontilhado de foco por dentro da borda, abas em "orelha" com a ativa subindo, e o
      desabilitado cinza com relevo branco. A hierarquia agora usa o vocabulário do próprio 98:
      "Rolar" é o BOTÃO PADRÃO (moldura preta de 1px + negrito) e o que está marcado (tipo de
      dado na rolagem, modo ativo, acabamento escolhido) fica AFUNDADO com fundo xadrez — antes
      os dois casos usavam o mesmo `variant="primary"`, então sete botões de dado disputavam
      destaque com a ação principal. Virou a prop `selected` do `Button`, separada da `variant`
- [x] Aba Estilo reorganizada em duas colunas: prévia 3D PARADA à esquerda e só as opções rolando
      à direita (antes era uma coluna só de nove seções empilhadas, então a prévia — a única forma
      de ver o efeito do que se mexe — saía da tela justo ao descer até as cores). As opções foram
      divididas em "Dados" e "Mesa e bandeja", uma de cada vez. As quatro listas de cor prontas
      (metálicas/gemas/foscas/plásticas), que eram quatro seções visualmente idênticas com quase
      cinquenta quadradinhos anônimos em sequência, viraram UMA seção com seletor de família; a
      amostra em uso aparece afundada com anel escuro, e o nome do preset sob o mouse aparece
      embaixo da grade (antes só parando o mouse em cima de cada um pra ler o `title`)
- [x] Corrigido: o seletor de "Modo de lançamento" (Bandeja/Torre) tinha sumido da interface — as
      traduções e o `setLaunchMode` continuavam no lugar, mas nenhum componente o renderizava, o
      que deixava a torre inteira (com toda a física própria dela) inalcançável. Voltou na aba
      Estilo → Mesa e bandeja
- [x] Mais estilos de bandeja prontos (1 → 6: Couro, Feltro verde, Veludo real, Taverna,
      Meia-noite, Pergaminho) e cada amostra agora mostra o PAR parede+chão na diagonal, em vez de
      só a cor do chão — com uma amostra só, a seção não se justificava
- [x] Botões do rolador reorganizados em duas caixas de grupo (`fieldset` com legenda etched, o
      group box clássico do 98): "Tipo de dado" (os sete dados numa grade de largura uniforme, em
      vez de uma fila irregular) e "Rolagem" (chips de quantidade, modo e modificador), com o
      "ROLAR" isolado na ponta direita ocupando a altura inteira da caixa. Antes eram três linhas
      soltas com o mesmo peso visual, e o "Rolar" ficava encostado nos botões de ajuste
- [x] Grama com três famílias de folha sorteadas por tufo (verde comum, palha ressecada e verde
      sombreado) — o usuário reportou que continuava "tipo sintética", e o que denunciava era a
      cor ser de um matiz só: uniformidade de cor é justamente a característica de grama
      artificial
- [x] Bandeja rústica de MADEIRA: parede hexagonal (e borda da mesa) com veio procedural —
      tábuas, linhas de veio onduladas, nós e junta entre peças, com normal map. Um ladrilho por
      lado do hexágono, pras tábuas acompanharem as faces em vez de cruzar as quinas. A cor
      escolhida na aba Estilo agora entra como TINTURA clareada em vez de multiplicar a textura:
      a primeira versão usava madeira em cinza neutro e a cor padrão do usuário (marrom quase
      preto) apagava o veio inteiro, virando um bloco escuro (`createWoodTexture.ts`)
- [x] Câmera no teclado: W/S aproxima e afasta, A/D gira em volta da mesa, Q/E sobe e desce
      (lidas por posição física da tecla, então funciona em ABNT2/AZERTY; ignoradas enquanto se
      digita num campo; soltas quando a janela perde o foco, pra tecla não ficar "grudada").
      Mexe na mesma órbita do mouse, respeitando os limites de zoom e de ângulo já existentes
- [x] Corrigido o "chiado" na base do estojo ao mexer a câmera, em duas frentes (z-fighting):
      (1) cantoneiras e friso estavam com a face de trás EXATAMENTE no plano da parede — agora
      afundam um tico na superfície em que estão pregados; (2) o forro do chão era afundado
      dentro do fundo maciço, com as faces de cima dos dois na MESMA altura e ambas apontando pra
      cima, o que fazia o piso inteiro (bem embaixo dos dados) piscar entre madeira e feltro —
      agora o forro é assentado POR CIMA do fundo, então as faces que se encostam apontam pra
      lados opostos e uma delas é sempre descartada, sem empate possível
- [x] Grama em TUFOS, com terra por baixo aparecendo nas falhas: folhas com posição uniforme dão
      densidade constante, e densidade constante é justamente o que não existe em grama de
      verdade. Tufos largos e de contraste baixo (a primeira tentativa, com moitas pequenas e
      claras, virou mancha na textura) + faixa estreita de verdes, pra somarem num tapete em vez
      de cada folha virar um traço destacado
- [x] Ornamentos de latão no estojo: cantoneiras nas quatro quinas (corpo e rodapé), rebites na
      frente, plaquinhas ladeando o fecho, friso na borda do topo e um emblema em losango no
      painel interno da tampa — a maior superfície virada pra câmera com o estojo aberto. O latão
      foi clareado e teve o `metalness` reduzido: metal muito metálico depende do reflexo do
      ambiente pra ter cor, e nesta cena as peças sumiam contra a madeira escura
- [x] Grama refeita ("a grama tá bem falsa"): ladrilho de 512px cobrindo 8 unidades de mundo (era
      256px a cada 2, e a repetição saltava aos olhos), variação de tom em três escalas em vez de
      uma, folhas curvas com comprimento/largura/tom variados e ponta mais clara, e filtragem
      anisotrópica — a mesa é vista quase de lado, ângulo em que a filtragem padrão borra a
      textura numa papa esverdeada
- [x] Abrir/fechar o estojo é SÓ clicando nele na cena 3D; o botão "Abrir/Fechar estojo" da barra
      do roller foi removido a pedido do usuário (raycast contra o grupo do estojo),
      com o cursor virando "mãozinha" ao passar por cima pra avisar que é clicável. Só conta
      como clique se o ponteiro andou menos de 5px entre apertar e soltar — senão terminar um
      arrasto de câmera em cima do estojo abriria a caixa sem ninguém pedir
- [x] Estojo com CORPO, não só paredes ("a base debaixo dele parece apenas paredes colocadas"):
      pezinhos + fundo maciço de espessura visível, apoiado em cima da mesa, com as paredes
      nascendo desse fundo. Saiu o pedestal enterrado de 3 unidades que existia só pra tapar o
      chão e não aparecia da câmera
- [x] Estojo refeito pra parecer estojo ("a base dos dados está muito desencaixada"): casca
      escura (cor de parede) × forro claro (cor do chão) no fundo, nas laterais e por dentro da
      tampa — o contraste é o que faz ler como caixa forrada, antes era tudo da mesma cor;
      paredes mais altas (0.34 → 0.42) e divisórias no forro, pros dados ficarem ENCAIXADOS em
      compartimentos em vez de empoleirados como num pente; tampa com a mesma planta da caixa e
      dobradiça no topo da parede (antes era maior que a caixa e aberta parecia uma placa solta
      pairando atrás); dobradiças e fecho em latão
- [x] Um único draw call por dado (atlas de textura com todas as faces numa imagem só, em vez de
      uma textura e um material POR FACE) — antes um d100 sozinho custava 100 draw calls. Medido
      com o HUD de debug, mesma cena de 13 dados (8 deles d100): 97 → 165 FPS (teto do monitor)
- [x] Dados param espalhados, não num reticulado: os alvos de pouso continuam vindo de uma grade
      (é ela que impede dois dados de nascerem sobrepostos), mas agora cada um é sorteado dentro
      da sua célula, e um dado sozinho cai num ponto aleatório da bandeja em vez de sempre no
      centro exato. Contenção reconferida com `diceEscape.test.ts` (3/3 execuções)
- [x] Mini pelúcia do Riebeck (Outer Wilds) na mesa ao lado do tabuleiro (`createRiebeckPlush.ts`,
      só primitivas do three) — REFEITA e religada. Ficou desligada um tempo porque as duas
      primeiras versões foram modeladas de memória e erraram o personagem: traje marrom com
      capacete oliva e um aro de visor com plaquinha de rosto amarelo por dentro. Comparando com
      as fotos do produto em `riebeck/`, a pelúcia real é corpo PÊSSEGO com cúpula AMARELA lisa,
      os quatro olhos bordados direto nela, faixa de tricô rosa na base da cabeça, calota
      prateada com antena de arames pretos, punho verde + anel creme nos braços e botas marrons.
      Junto veio a mudança de técnica que tirou a "placa de rosto": os olhos agora são pintados
      no `map` da PRÓPRIA esfera da cabeça (UV equirretangular, canvas 2:1 pra pixel quadrado na
      superfície) em vez de num disco chapado colado na frente — o disco existia pra fugir da
      paralaxe, mas era ele que obrigava a cabeça a ter um visor que a pelúcia não tem.
      Três acertos só apareceram vendo rodar, não na conta: o olho de baixo saía cortado ao meio
      pela faixa de tricô (a faixa sobressai da cúpula e, com a câmera de cima, tapa bem acima da
      linha onde cruza), o banjo estava na altura dos pés cobrindo as botas, e o chapéu das
      costas aparecia como uma lasca cinza no ombro — removido, detalhe que só existe de um
      ângulo que a câmera não usa. Pra desligar de novo, `SHOW_PLUSH = false` em
      `DiceCanvasMulti.tsx`
- [x] Riebeck com o equipamento de ASTRONAUTA que faltava, depois de o usuário apontar o que o
      personagem é (não só como ele é pintado): tanque de oxigênio nas costas, lanterna no ombro
      direito dele e o emblema do peito virando o TRIÂNGULO da Outer Wilds Ventures, no lugar de
      uma rodela genérica. E o arranjo dos olhos foi corrigido pro que a foto mostra — UM do lado
      direito dele e TRÊS do esquerdo, não dois de cada lado; a posição de cada um saiu de medir
      a foto e desfazer a projeção (num rosto esférico, um olho a α graus do centro aparece a
      `sin(α)` da metade da largura da cúpula), não de tentativa e erro. Mais duas coisas que só
      a execução revelou: com o topo dos tanques na altura da cabeça as duas calotas claras viravam
      um par de ORELHAS de cada lado da cúpula (baixados pra terminarem abaixo da linha do tricô),
      e a lanterna nasceu com o vidro aceso DENTRO do próprio corpo dela, invisível de qualquer
      ângulo — o que faz ler como lanterna não é ter um vidro, é o vidro aparecer entre duas peças
      escuras
- [x] Riebeck mudou pro FUNDO da cena, quase na beirada da grama (raio ~15.1 de um gramado de raio
      16), e ficou com UM cilindro de gás só nas costas em vez de dois — os dois a pedido do
      usuário. O lado (fundo à direita) não é indiferente: o estojo de dados ocupa o fundo à
      esquerda e, do lado de cá do tabuleiro, a beirada da grama cai atrás da câmera — não existe
      "fim da grama" visível pra frente. O giro dela agora sai de um `atan2` até
      `CAMERA_CONFIG.position` em vez de um ângulo escolhido na mão, senão lá do fundo ela
      apareceria de lado. Como só a posição mudou e não o tamanho, ela aparece ~1.6× menor na tela
      do que aparecia perto da câmera
- [x] `createRiebeckPlush.test.ts`: as duas falhas da pelúcia que só apareciam abrindo o app viraram
      teste (tanque que sobe até virar orelha ao lado da cabeça; vidro da lanterna lacrado dentro
      do corpo dela). Nenhuma das duas é pegável por typecheck ou por "renderizou sem erro" — as
      versões quebradas montavam a cena perfeitamente, o defeito era relação geométrica entre
      peças. Os dois testes foram conferidos REINTRODUZINDO cada bug e vendo falhar, e nas duas
      primeiras versões eles passavam pelo motivo errado: um comparava a caixa do vidro com a
      caixa das DUAS peças de casco somadas, e o outro media contra o topo da caixa da faixa —
      que a inclinação da cabeça joga quase 0.2 acima da linha onde o tricô realmente cruza, folga
      suficiente pro tanque voltar pra altura das orelhas sem ninguém reclamar. Rodam em Node com
      um dublê de canvas 2D, sem jsdom
- [x] Estojo sem os detalhes DOURADOS, mais rústico e antique (pedido do usuário) — saíram as
      cantoneiras de latão das quatro quinas, os rebites da frente, as plaquinhas do fecho, o
      friso do topo e o emblema em losango do forro da tampa. Ficaram só as dobradiças e o fecho,
      porque são funcionais (são eles que dizem "isto abre" com a tampa parada), agora em FERRO
      escuro e fosco em vez de latão polido: latão claro e reluzente é a leitura de ferragem nova,
      justamente o contrário do pedido. Duas trocas sustentam o "rústico" no lugar dos ornamentos:
      a casca ganhou o mesmo veio de madeira da parede da bandeja e da borda da mesa
      (`createWoodTexture.ts`, que já existia) e ficou bem mais áspera — sem os ornamentos, uma
      caixa de cor chapada não é uma caixa simples, é um bloco de cor sem material nenhum. E a
      madeira do estojo é ESCURECIDA em 0.72 sobre a da bandeja: na primeira tentativa ela saiu no
      tom exato da parede do tabuleiro logo atrás e o estojo sumia contra ela — conferido medindo o
      pixel dos dois materiais na mesma captura (206,162,118 contra 201,158,114), não a olho
- [x] Bandeja ganhou BASE e REBORDO, copiando a referência que o usuário deixou em
      `ideias/plataforma ideia.webp` (uma bandeja hexagonal de MDF cortada a laser): uma caixa
      hexagonal baixa embaixo, uma aba plana correndo em volta do topo dela e SALTANDO pra fora —
      é esse balanço que faz ler como "bandeja montada sobre uma base" em vez de caixa só — mais
      os rasgos escuros de encaixe queimado nas bordas. O chão de veludo fica FUNDO em relação à
      aba, igual na foto. Usa a mesma madeira e a mesma cor da parede (só `FrontSide`, porque a
      parede é `BackSide` de propósito), então acompanha a aba Estilo sem configuração nova.
      A primeira tentativa foi uma escadaria de PEDRA tipo base de coliseu, reprovada pelo usuário
      — ele então apontou a referência, que não é de pedra nem tem degraus. Dois números não são
      de gosto: a altura do rebordo (0.58) é limitada pela câmera, porque a quina interna dele
      projeta sombra de visão sobre o chão (a reta que sai da câmera e passa por ela chega ao chão
      a z≈6.1, com a parede em 6.5), e subir mais come dado encostado na parede da frente; e o giro
      dos rasgos é `sideAngle + 90°`, DERIVADO da tangente do lado (o Y do `Shape` vira -Z ao
      deitar a geometria) depois de a primeira versão sair com todos eles atravessados na aba,
      apontando pro centro em vez de acompanharem a aresta
- [x] Bandeja virou uma CAIXA ELEVADA sobre a mesa, segunda leitura da mesma foto depois de o
      usuário dizer que ainda não estava igual. A primeira versão punha a aba alta e o veludo fundo
      no meio, tipo poço; ampliando o canto da frente da foto dá pra ver que não é isso — o chão
      dos dados é a superfície de CIMA e a aba é a sobra do próprio painel do chão passando por
      fora, em balanço sobre a caixa. Como o chão da bandeja está preso em y=0 (é onde mora o
      collider físico), quem desceu foi a MESA (`TABLE_DROP`), abrindo altura real embaixo pra
      caixa existir — e o estojo e a pelúcia desceram junto, senão ficariam flutuando. O balanço da
      aba (0.18, bem menor que na foto) é imposto pela câmera: ela chega no rebordo da frente a
      ~60° de elevação, e nesse ângulo uma aba que avança `O` esconde `1.7·O` de altura da caixa —
      com os 0.45 da primeira tentativa a caixa inteira ficava tapada pela própria aba e a bandeja
      voltava a parecer um aro deitado na grama. Uma diferença ficou DE PROPÓSITO: na foto se vê a
      parede da frente por dentro, aqui não — resolvido no item seguinte
- [x] PAREDE da bandeja virou um anel MACIÇO (espessura e topo de verdade) nascendo da aba, no
      lugar da casca vazada renderizada só por dentro (`BackSide`). Era o "o problema são as
      paredes": com `BackSide` a parede da frente sumia inteira, então da câmera a bandeja ficava
      torta — parede alta no fundo, nada na frente, só a aba plana — enquanto a referência é uma
      caixa rasa com parede dando a volta. A altura visível (0.75) tem limite de visão, não de
      gosto: uma parede maciça de altura `h` tapa a faixa de chão colada nela até
      `6.5 - 8.15·h/(13-h)`, então os 1.8 da casca antiga esconderiam 1.3 de bandeja na frente
      (dado inteiro) — era justamente por isso que a versão antiga precisava do truque do
      `BackSide`. Com 0.75 a faixa cai pra ~0.5 e a face de cima do dado, que é a que se lê,
      continua visível. Some junto o material separado da parede: agora caixa, aba e parede
      compartilham uma madeira só. `createWalls` foi removida, mas o comentário dela ficou — o
      `thetaStart: -Math.PI/2` que ela precisava vale pra qualquer hexágono novo por aqui
- [x] Corrigido "as coisas tão flutuando", dois pontos que ficaram pra trás quando a bandeja subiu:
      os dados da prateleira são adicionados direto na CENA (não dentro do grupo do estojo), então
      continuaram na altura antiga enquanto o estojo descia pra mesa; e o caminho que RECRIA o
      estojo quando se troca uma cor não repunha a altura de mesa, o que jogava o estojo de volta
      pro y=0 e deixava os dados pendurados por baixo dele. A altura dos dados virou uma função
      (`shelfDieY`) justamente pra os dois pontos que posicionam prateleira não poderem divergir
      de novo
- [x] Pelúcia trazida PRA DENTRO da mesa (raio ~13 em vez de ~15.1, num gramado de 16) e apoiada
      em `TABLE_SURFACE_Y` — a superfície de grama, que fica 0.03 abaixo da origem do grupo da
      mesa, e não em `-TABLE_DROP` como estava. No lugar antigo bastava girar a câmera pra ela cair
      contra o fundo preto em vez de contra a grama: de certos ângulos a faixa de gramado atrás
      dela virava dois ou três pixels e ela lia como flutuando no vazio. "No fim da grama" só
      funciona olhando de frente; com órbita livre precisa de margem
- [x] Fora as listras pretas: os rasgos de corte a laser na aba e as juntas nas quinas eram fiéis à
      foto, mas na escala da cena viravam um tracejado preto em volta da bandeja
- [x] Madeira do estojo bem mais escura e rústica, separada da do tabuleiro (pedido do usuário):
      escurecimento de 0.72 → 0.42 sobre a cor escolhida, tábua bem mais estreita (repetição 3 → 7,
      porque tábua fina lê como ripa rústica e tábua larga como painel industrial), relevo mais
      fundo e brilho quase zerado. Conferido medindo o pixel dos dois materiais na mesma captura:
      estojo (143,114,86) contra bandeja (196,153,112)
- [x] Três modos de CÂMERA no WASD (pedido do usuário), na aba Estilo → Mesa e bandeja: "Pela mesa"
      (desliza no plano da mesa, com o passeio preso ao tampo), "Travada nos dados" (o alvo persegue
      sozinho, suavizado, onde os dados pararam) e "Livre" (voa na direção do olhar, Q/E sobem e
      descem de verdade). Trocar de modo NÃO remonta a cena: o modo é lido de um `ref` dentro do
      laço de animação, senão mudar como três teclas são interpretadas custaria física, texturas e
      dados novos. A matemática saiu do componente pra `applyCameraKeys.ts` por um motivo prático:
      teclado sintético não chega numa janela do Electron fora de primeiro plano, então essa é a
      única parte da cena que NÃO dá pra conferir com uma captura de tela — os 12 casos de
      `applyCameraKeys.test.ts` são o que substitui isso, e foram verificados quebrando de
      propósito o "move câmera e alvo juntos" (5 deles falham na hora). Duas armadilhas que os
      testes fixam: mover só a câmera transforma o deslizar em ÓRBITA, e travar só o alvo na
      beirada da mesa gira o enquadramento em vez de só parar o passeio
- [x] O seletor de câmera saiu da aba Estilo e virou três ÍCONES sobrepostos à cena
      (`CameraModeSwitch.tsx`), a pedido do usuário ("não gostei de ser no estilo, deixa algo na
      tela"): setas em cruz = anda pela mesa, MIRA sobre um dado = travada (o "lock", referência
      dele foi mira de Valorant), olho aberto = solta. Faz sentido — é um controle que se mexe
      OLHANDO a cena, e trocar de aba pra travar/soltar quebra o que ele serve pra fazer. Ícones em
      SVG inline, não emoji nem fonte de ícone: o app é offline e emoji de mira/olho muda de
      desenho conforme o sistema. A primeira versão do painel usava `pointer-events: none` no pai
      com `auto` só nos botões e NÃO respondia a clique nenhum — descoberto clicando nos três
      ícones e vendo o modo não mudar, com um clique de controle no botão "d6" no mesmo teste pra
      provar que o clique chegava no app
- [x] Corrigido de vez o "Riebeck flutuando", que sobreviveu a dois acertos de altura porque a
      altura nunca foi o problema: a câmera de sombra da cena cobre um raio de `circumradius + 2`
      (~9.5, dimensionado pra bandeja) e a pelúcia mora a ~13 do centro, ou seja, fora do alcance —
      ela não projetava sombra NENHUMA, e objeto sem sombra de contato lê como flutuando por mais
      encostado que esteja. Ganhou uma mancha de sombra própria, desenhada em canvas e presa ao
      grupo dela. Alargar o frustum resolveria e sairia caro no lugar errado: o mesmo mapa de 2048
      cobriria mais que o dobro de área, perdendo resolução justamente nas sombras dos DADOS
- [x] O "Riebeck flutuando" era, na verdade, o BONECO não encostar no chão dentro do próprio grupo
      — achado só depois de MEDIR peça por peça, em vez de tentar de novo pelo olho (foram três
      relatos e duas tentativas erradas antes: altura da mesa e sombra de contato). O corpo é uma
      esfera de raio 0.56 achatada em 0.92 e centrada em 0.60, ou seja, a barriga termina em 0.085,
      e a única coisa que descia até o chão eram as duas botas, pequenas e lá na frente: de
      qualquer ângulo que não fosse bem de frente, a bola do corpo aparecia pairando com um vão
      embaixo. O boneco passou a afundar 0.075 dentro do grupo (a sombra fica de FORA desse
      deslocamento, senão afunda junto e some). O teste que cobria isso media a caixa inteira e
      passava mesmo com a barriga no ar, porque as botas puxavam o mínimo pra baixo — agora ele
      mede o CORPO, e ganhou um contrapeso pra afundar não virar "enterrar o boneco". O valor de
      TANGÊNCIA exata (0.075, barriga raspando o chão) ainda foi reportado como flutuando — contato
      de área ZERO não convence ninguém num boneco de ~20px na tela —, então `SIT_DEPTH` foi pra
      0.16: a barriga encosta e afunda um pouco, como pelúcia largada num gramado, e a sombra de
      contato ficou maior e mais escura junto. Errar pro lado de afundar é barato; errar pro lado
      de flutuar custou três rodadas. E, como AINDA foi reportado como flutuando com o corpo já
      afundado, veio a suspeita seguinte: as BOTAS eram marrom-escuras (0x4b2f1b) logo abaixo de um
      corpo pêssego claro, e a ~20px uma faixa escura embaixo do boneco não lê como bota, lê como
      VÃO entre ele e o chão. Foram clareadas pra marrom médio. Confirmado antes que não era build
      velho nem segunda instância do app (só um Electron e um dev server rodando na máquina)
- [x] A causa REAL do "está flutuando" (repetido quatro vezes) era MARGEM DE GRAMADO, não altura,
      nem sombra, nem cor de bota: a pelúcia estava perto da beirada do disco, e de câmera BAIXA e
      afastada ela aparece acima da linha do horizonte do gramado, recortada contra o fundo preto —
      lê como boiando no vazio. Raio ~12.9 → ~9.2 (gramado de 16) resolve: sobram quase 7 unidades
      de grama em volta e nenhum ângulo de órbita a joga contra o fundo.
      O motivo de eu não conseguir reproduzir por três rodadas seguidas vale registrar: eu
      RECARREGAVA o app antes de cada captura, e o reload reseta a câmera pro enquadramento padrão
      (alto e de frente), justamente o único ângulo em que o defeito não aparece. Foi o usuário
      mandando "olha pelo ângulo que está agora" que quebrou o impasse — capturar SEM recarregar
      mostrou o problema no primeiro print. Lição pra qualquer bug visual reportado daqui pra
      frente: capturar o estado do usuário antes de reiniciar qualquer coisa
- [x] Pelúcia ATRÁS do estojo, na quina traseira direita e virada pra bandeja (`atan2` até o centro
      da mesa, não até a câmera — o pedido foi "com vista do dado", e olhando pra câmera ela ficaria
      de costas pro jogo). Primeiro ficou atrás do meio do estojo e encavalou na tampa aberta,
      parecendo presa nele; saiu pra fora da quina. E `SIT_DEPTH` foi de 0.16 pra 0.42: a barriga
      entra quase um terço no gramado, as botas somem enterradas, e a mancha de sombra cresceu
      (raio 0.85 → 1.05) pra sobrar pra fora da silhueta do corpo — escondida embaixo dele, ela não
      ancorava nada
- [x] A CAUSA REAL do "o plush está flutuando", reportado SEIS vezes: a animação de respiração da
      pelúcia fazia `plush.position.y = sen(t) * 0.015` — ATRIBUINDO em vez de somar. Isso
      descartava a altura definida na montagem e prendia o boneco oscilando em torno de y=0, que é
      a altura do CHÃO DA BANDEJA; depois que a mesa foi rebaixada (`TABLE_SURFACE_Y`), virou uma
      pelúcia pairando 0.78 acima do gramado, para sempre. Agora a altura de repouso é guardada em
      `userData.restY` e a respiração é um deslocamento em cima dela.
      Vale registrar a caçada, porque foi cara: mexi em altura da mesa, sombra de contato,
      profundidade de assentamento, cor de bota, raio de sombra e posição — NADA disso podia
      funcionar, porque tudo era sobrescrito no frame seguinte. O usuário chegou a descrever o
      sintoma exato ("ele está na mesma altura que o dado no hexágono") e eu tratei como impressão
      de perspectiva em vez de medida literal, que era o que era. O que finalmente apontou pro
      lugar certo foi ele insistir "não está descendo" depois de um reload que comprovadamente
      aplicava a posição nova: se a posição é aplicada e o objeto não se move, quem manda na
      posição é outro. Todos os exageros empilhados durante a caçada foram desfeitos
      (`SIT_DEPTH` 0.42 → 0.14, `PLUSH_SINK` 0.5 → 0, botas de volta ao marrom escuro da foto)
- [x] Rolar um PRESET não remonta mais a cena na bandeja — pedido do usuário, que reclamou de a
      câmera e o campo inteiro resetarem a cada preset. `presetRollSeq` saiu do `key` de
      `DiceCanvasMulti` no modo bandeja: preset passou a usar o mesmo caminho das trocas manuais
      (resincroniza os dados no lugar) e a rolagem sai de um efeito do PAI, que roda depois do
      resync do filho — chamar `roll()` dentro do próprio handler arremessaria o conjunto de dados
      ANTIGO, porque o `setGroups` da mesma função ainda não passou pelo React. A torre continua
      remontando: lá a rolagem é uma fila com parqueamento e cortá-la no meio deixa dados presos.
      Com isso caiu também o `if (isRolling) return` da bandeja: clicar preset por cima de uma
      rolagem em andamento virou só arremessar de novo, e o botão de rolar do preset deixou de
      ficar travado durante a rolagem (editar/excluir seguem travados — o motivo deles é outro).
      BUG que a primeira versão desta mudança introduziu, achado testando: o efeito dependia da
      referência de `groups`, e `handlePresetRoll` entrega SEMPRE o mesmo array (`preset.expression
      .groups`). Clicar o mesmo preset duas vezes fazia o React descartar o `setGroups` por
      referência igual, nenhum efeito rodava, `roll()` nunca era chamado e a interface travava em
      "Rolando..." pra sempre. O gatilho virou o contador `presetRollSeq`, que sempre muda
- [x] Prévia da BANDEJA na aba Estilo (`TrayPreview.tsx`), ao lado da prévia do dado que já existia
      — pedido do usuário. Aparece quando a seção "Mesa e bandeja" está aberta e a do dado quando
      "Dados" está: as duas ao mesmo tempo custariam duas cenas WebGL vivas e espremeriam ambas na
      mesma coluna estreita. A geometria vem de `createTrayPreview`, que monta com as MESMAS
      funções da cena real (`createFloor`, `createArenaPlatform`, mesmos materiais e mesmo
      `woodTint`) — prévia que erra material ou proporção é pior que prévia nenhuma, porque ensina
      errado. As cores entram por `updateColors` sobre os materiais existentes, sem reconstruir:
      arrastar o seletor dispara `input` continuamente e refazer as texturas procedurais de madeira
      e veludo a cada evento travaria a interface. O ESTOJO também entra na prévia (pedido do
      usuário: ele é tingido pela mesma cor de parede, numa versão bem mais escura, e não dava pra
      ver isso sem voltar pra aba Rolagem) — montado no componente, e não dentro de
      `createTrayPreview`, porque `createScene.ts` é importado por `DiceCanvasMulti.tsx` e não pode
      importar de volta sem fechar um ciclo. Bandeja e estojo giram num grupo só: girar só a
      bandeja deixaria o estojo parado ao lado, como se não fossem a mesma mesa
- [x] Corrigido "o nome dos golpes está dando conflito com os resultados": num flex column todo
      item tem `flex-shrink: 1`, então com a janela curta o navegador espremia as seções de
      `.app-main`. A do rolador não encolhe de verdade (a cena tem `min-height: 420px`), mas a
      CAIXA dela encolhia — e a linha de resultado, que vem depois da cena, vazava pra fora da
      seção e era desenhada POR CIMA da lista de presets, empilhando o texto do resultado e o nome
      do preset no mesmo lugar. `flex-shrink: 0` nas seções: o conteúdo empurra a altura e o
      `overflow-y: auto` que `.app-main` já tinha passa a rolar, que é o que deveria fazer
- [x] Mais cores ROSA nas quatro paletas prontas (pedido do usuário — só existiam Ouro Rosé e
      Chiclete, cada um sozinho na sua família): Pérola Rosa e Cromo Magenta nas metálicas; Rubi,
      Turmalina Rosa e Quartzo Rosa nas gemas; Rosa Antigo e Blush nas foscas; Rosa Neon e Rosa
      Pastel nas plásticas. Cada família mantém a própria regra — gema com corpo fundo e número
      claro, fosco em tom quebrado (rosa puro sem brilho lê como plástico), plástico podendo ser
      berrante. Nos estilos de BANDEJA entraram Veludo rosa, Feltro blush e Camurça magenta — com o
      rosa no CHÃO, não na parede: a parede não é cor chapada, é a tintura da textura de veio
      (`woodTint`), e rosa puro nela apaga o veio e vira um bloco de plástico em volta da bandeja,
      então ela acompanha num amadeirado que puxa pro rosado
- [x] Corrigido o botão do olho "saindo do lugar" ao ser clicado: `global.css` troca o `padding` de
      QUALQUER `button` no `:active` (de `4px 12px` pra `5px 11px 3px 13px`), que é o "rótulo
      afunda" do Windows 98. Num botão com moldura o efeito está certo; naquele, que não tem
      moldura, tem tamanho fixo e centraliza o ícone por grid, mexer no padding só desloca o
      desenho. Sem degrau pra afundar, não há o que afundar — `padding: 0` no `:active` dele
- [x] d6 e d12 menores (0.7 → 0.62 e 0.49 → 0.43), com o usuário reportando os dois maiores que os
      vizinhos. No d6 não era impressão e a conta explica: `scale` ali é a ARESTA do cubo, e o raio
      circunscrito sai dela vezes `boundingRadius` (√3/2) — 0.7 dava 0.606 contra os 0.56 dos dados
      que usam `scale` já como raio, ou seja, o d6 era mesmo o maior de todos, e um cubo ainda
      enche muito mais volume que um poliedro quase esférico do mesmo raio. Agora dá 0.537, logo
      abaixo do d20. No d12 é o efeito já registrado no arquivo dele: pentágono ocupa mais área
      visual que triângulo no mesmo raio, então ele precisa de raio nominal menor pra PARECER do
      mesmo tamanho. Os testes de contenção e de escape passaram sem ajuste
- [x] Os três botões de câmera viraram UM só: o olho, a pedido do usuário ("ficou estranho os 3").
      Aberto e mais visível = travada nos dados; cortado e a 20% de opacidade = solta. O motor
      continua com os três modos (`applyCameraKeys.ts` e os testes dele seguem valendo), mas a tela
      expõe só o que se usa de verdade — qual modo é o "solto" é uma linha (`LOOSE_MODE`), e é o
      `table` e não o `free` porque o livre voa pra fora da mesa e é fácil se perder nele, ruim
      demais pro estado padrão de um botão que se aperta sem pensar. Sem moldura de botão 98: com
      20% de opacidade o degrau de relevo viraria sujeira cinza no canto em vez de controle.
      Opacidade baixada duas vezes a pedido dele: 0.06 em repouso e 0.25 travado, cheia no hover
- [x] Enquadramento não sai mais do lugar a cada rolagem: a recentralização automática da câmera
      (que movia o alvo da órbita pra cima de onde os dados pousavam) desabava a cena inteira —
      bandeja rasa, quase de perfil, às vezes escondida atrás da própria parede — e o desvio
      ficava pelas rolagens seguintes. Tentado primeiro limitar o deslocamento: com 2 e até com
      1 unidade o quadro ainda desabava; só com ZERO ele fica idêntico antes e depois. Então a
      recentralização automática foi REMOVIDA — a órbita manual (arrastar na cena) continua
      igual, e nada mais mexe na câmera sozinho. Conferido em rolagens seguidas, todas
      terminando no mesmo enquadramento
