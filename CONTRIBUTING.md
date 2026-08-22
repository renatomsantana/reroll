# Contribuindo com o Reroll

Obrigado por olhar. Este é um projeto pessoal feito para uma mesa de RPG de verdade, então a régua
aqui é prática: o que entra precisa funcionar para quem joga, não só para quem programa.

## Antes de tudo: conferir um download

Se você chegou aqui só para saber se o instalador é confiável, é isto:

```powershell
Get-FileHash .\Reroll-Setup-1.0.10.exe -Algorithm SHA256
```

O resultado tem que bater com a linha correspondente em `SHA256SUMS.txt`, anexado na
[página da release](https://github.com/renatomsantana/reroll/releases). Esse arquivo é gerado pelo
GitHub Actions a partir do commit etiquetado — não pela máquina de ninguém.

O Reroll **não tem certificado de assinatura digital**, então o Windows mostra um aviso do
SmartScreen na primeira execução. O código aberto, o build automatizado e o resumo acima são o que
existe no lugar do certificado.

## Rodando o projeto

Precisa de [Node.js](https://nodejs.org) 22 ou mais novo.

```bash
npm install
npm run dev      # abre o app com recarregamento automático
```

## Antes de abrir um pull request

```bash
npm run check    # tipos + análise estática + testes, os três de uma vez
```

É exatamente o que o CI roda. Se passar aqui, passa lá.

Comandos separados, quando for útil:

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | Confere os tipos dos três projetos (main, renderer, testes) |
| `npm run lint` | ESLint, sem tolerância a aviso |
| `npm test` | Vitest |
| `npm run build` | Compila os três bundles em `out/` |
| `npm run dist:win` | Gera o instalador em `release/` |

## Como o código é escrito aqui

Duas convenções, e as duas são deliberadas.

**Os comentários explicam POR QUÊ, não o quê.** O código já diz o que faz. O que se perde com o
tempo é a razão — por que este limite é 12 MB, por que esta trava existe, o que quebrou da última
vez que alguém tentou o caminho óbvio. Um comentário que só reescreve a linha abaixo em português é
ruído; um que registra um defeito já sofrido vale mais que o teste dele.

Quando você conserta algo, escreva o que estava acontecendo antes. É o que impede a próxima pessoa
(quase sempre você mesmo, seis meses depois) de "simplificar" o conserto de volta para o defeito.

**O código e os comentários são em português.** Nomes de função, variáveis e testes inclusive. O
projeto é brasileiro e a maior parte do vocabulário é de RPG em português.

## Testes

Teste que só confirma que o código faz o que está escrito nele não ajuda. O que vale a pena testar:

- **decisões que erram em silêncio** — um dado que cai no bloco errado da ficha não dá erro, só
  aparece na aba errada e alguém descobre uma semana depois;
- **o que já quebrou uma vez** — se um defeito chegou até a máquina de alguém, ele merece um teste
  com o nome do que aconteceu;
- **as fronteiras** — o que chega de arquivo em disco, de PDF de terceiro, de `localStorage` de uma
  versão antiga do app.

Teste de dado **não pode falhar sozinho**. Onde há sorteio, a fonte de números é substituída por uma
sequência determinística (ver `justicaDoSorteio.test.ts`). Um teste que falha uma vez a cada vinte
execuções é um teste que todo mundo aprende a ignorar.

## Segurança

O app é distribuído para gente que não é de computador, e ele faz duas promessas que estão impostas
em código, não confiadas à boa vontade:

1. **não pede acesso a nada** da máquina — câmera, microfone, localização, notificação;
2. **não fala com a internet**, exceto para perguntar ao GitHub se existe versão nova.

As duas moram em `src/main/seguranca.ts`, com o porquê de cada linha. Mudança que afrouxe qualquer
uma delas precisa de uma justificativa muito boa — e de um teste.

## Publicando uma versão (para quem tem acesso de escrita)

1. Suba a versão no `package.json`;
2. escreva a seção nova do `CHANGELOG.md`;
3. `git tag v1.0.10 && git push origin v1.0.10`;
4. o CI compila, empacota, calcula os SHA-256 e cria a release **como rascunho**;
5. suba o instalador no [VirusTotal](https://www.virustotal.com/), cole o link do resultado nas notas
   da release, ao lado do resumo;
6. publique.

O passo 6 é manual de propósito: publicar é o gesto que dispara o update automático na máquina de
todo mundo que já instalou.

## Reportando um problema

Diga o que aconteceu, o que você esperava, e a versão (Preferências mostra). Se for algo da bandeja
3D, diga também que computador é — placa de vídeo velha é a causa mais comum, e para esse caso
existe o modo de resultado rápido em Preferências.
