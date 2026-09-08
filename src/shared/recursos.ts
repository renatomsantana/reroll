/**
 * O que está LIGADO nesta versão.
 *
 * Um arquivo só, com uma constante por recurso e o motivo escrito ao lado. A alternativa — arrancar
 * o código do recurso e trazê-lo de volta depois — custa muito mais e erra muito mais: sai junto o
 * que era compartilhado, volta sem o que se aprendeu no caminho, e o histórico fica com um buraco
 * onde deveria estar a razão.
 */

/**
 * IMPORTAR FICHA DE PDF, o "scraping" da seção 3 da spec. LIGADO no 1.1.0-beta: a aba Ficha volta à
 * interface marcada como "(beta)", com o botão de importar e os dois canais de IPC que ele usa.
 *
 * A história desta bandeira, porque ela já virou três vezes:
 *
 * 1. ligada no primeiro 1.1.0 e desligada na mesma rodada, por ele, depois de olhar a importação
 *    rodando: "ainda tem muitos erros para todas as informações". O que o leitor trazia estava certo
 *    campo a campo, mas deixava informação de fora — os valores atuais de PV, PE e Sanidade —, e ficha
 *    importada pela metade é pior que ficha em branco, porque quem confia na tela não confere o que
 *    faltou;
 * 2. desligada no fechamento do alfa, por escopo: a versão que vai pros amigos é só o que já está
 *    rodado à exaustão;
 * 3. ligada de novo aqui, depois do que foi consertado e MEDIDO nas fichas reais — pares atual/máximo
 *    inteiros mesmo com metade em branco, esqueleto de lacunas em toda ficha com dono, Aspectos e
 *    Equipamento de Oblívio, ritual e item entrando uma vez só, modelo em branco sem ganhar o nome do
 *    arquivo, e o PDF com teto de campos, páginas e tamanho, com assinatura conferida antes do IPC.
 *
 * Continua valendo: o rótulo "(beta)" avisa que a leitura pode errar em sistema desconhecido, e ficha
 * que é arte achatada não rende nada sem OCR. Desligar é trocar pra `false`: some o botão e somem os
 * canais, dos dois lados.
 */
export const IMPORTACAO_DE_FICHA_LIGADA = true
