# Histórico de versões

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões seguem
[SemVer](https://semver.org/lang/pt-BR/).

Cada versão publicada tem o SHA-256 do instalador na página da release — confira antes de instalar
(ver `CONTRIBUTING.md`).

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
