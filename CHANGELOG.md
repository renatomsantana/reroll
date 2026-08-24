# Histórico de versões

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões seguem
[SemVer](https://semver.org/lang/pt-BR/).

Cada versão publicada tem o SHA-256 do instalador na página da release — confira antes de instalar
(ver `CONTRIBUTING.md`).

## [Não publicado] — 1.1.0-beta.1

Começa o BETA. O alfa fechou no 1.0.12; o que muda de fase é a importação de ficha em PDF, que
volta à interface marcada como beta, e a base pra ela crescer segundo o spec de importação
(`AGENT_SPEC_pdf-import.md`): validação do arquivo, leitura, modelos por sistema, geração de
presets e a tela de conferência — cada etapa um módulo puro com os próprios testes.

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
    era medida do centro da caixa — agora é da borda, e a régua é uma só pros dois lugares que mediam.

### Mudado

- **O seletor de personagem fica só na Ficha.** Nas Anotações e na Rolagem entra um crachá do
  personagem ativo — foto 3×4 e nome (na Rolagem, da altura do botão ROLAR) —, só de leitura: a troca acontece num lugar só, e as
  outras abas lembram de quem se trata. (O seletor tinha entrado nas Anotações no 1.0.12, quando a
  Ficha estava fora da interface.)

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
