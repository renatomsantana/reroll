/**
 * O que está LIGADO nesta versão.
 *
 * Um arquivo só, com uma constante por recurso e o motivo escrito ao lado. A alternativa — arrancar
 * o código do recurso e trazê-lo de volta depois — custa muito mais e erra muito mais: sai junto o
 * que era compartilhado, volta sem o que se aprendeu no caminho, e o histórico fica com um buraco
 * onde deveria estar a razão.
 */

/**
 * IMPORTAR FICHA DE PDF — o "scraping" da seção 3 da spec.
 *
 * LIGADO no 1.1.0-beta. A aba Ficha volta à interface marcada como "(beta)", com o botão de
 * importar e os dois canais de IPC que ele usa (`sheets:pickPdf` e `sheets:apply`).
 *
 * A história desta bandeira, porque ela já virou três vezes:
 *
 * 1. LIGADA no primeiro 1.1.0 e DESLIGADA na mesma rodada, pelo usuário, depois de olhar a
 *    importação rodando: "ainda tem muitos erros para todas as informações". O que o leitor trazia
 *    estava certo campo a campo, mas deixava informação de fora — os valores ATUAIS de PV, PE e
 *    Sanidade, entre outros —, e ficha importada pela metade é pior que ficha em branco, porque
 *    quem confia no que está na tela não confere o que ficou faltando.
 * 2. DESLIGADA no fechamento do alfa (1.0.12), decisão de ESCOPO: a versão que vai pros amigos é
 *    só o que já está rodado à exaustão. Uma ficha preenchida à mão continuou sendo do alfa.
 * 3. LIGADA de novo aqui, depois do que foi consertado e MEDIDO nas fichas reais: os pares
 *    atual/máximo vêm inteiros mesmo com metade em branco; toda ficha com dono traz o esqueleto de
 *    lacunas (tudo o que é preenchível, mesmo vazio, porque "às vezes precisamos preencher no app
 *    também"); Oblívio traz Aspectos e Equipamento; ritual e item preenchidos entram uma vez só;
 *    um modelo em branco não ganha o nome do arquivo como personagem; o PDF tem teto de campos,
 *    fragmentos, páginas e tamanho, e assinatura `%PDF-` conferida antes de atravessar o IPC.
 *
 * O que continua sendo verdade: o rótulo "(beta)" na aba e o aviso na tela de conferência avisam
 * que a leitura pode errar em sistema que o app não conhece, e ficha que é ARTE ACHATADA (sem
 * camada de texto) não rende nada sem OCR — que é o item 1c do spec e ainda não existe.
 *
 * Desligar é trocar pra `false`: some o botão e somem os canais, dos dois lados.
 */
export const IMPORTACAO_DE_FICHA_LIGADA = true
