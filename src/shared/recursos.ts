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
 * DESLIGADO no fechamento do alfa, a pedido do usuário ("ignora tudo de scraping agora, deixa o
 * scraping offline"), e a decisão é de ESCOPO, não de qualidade: o leitor de Ordem Paranormal, o de
 * D&D 5e, o de Oblivio, o genérico e a tela de conferência estão escritos, testados e funcionando.
 * Eles são o BETA, e o alfa fecha sem eles pra que a versão que vai pros amigos seja só o que já
 * está rodado à exaustão.
 *
 * O que fica desligado: o botão de importar na aba Ficha e os dois canais de IPC que ele usa
 * (`sheets:pickPdf` e `sheets:apply`) — o app instalado não tem por onde abrir um PDF.
 *
 * O que CONTINUA valendo: a aba Ficha inteira (perfil, blocos, seções), porque uma ficha preenchida
 * à mão é do alfa; e as seções que já foram importadas por quem usou as versões anteriores, que
 * continuam na tela e editáveis. Desligar o importador não pode apagar o que ele já trouxe.
 *
 * LIGADO no 1.1.0 — é o beta que esta constante estava esperando.
 *
 * O que a varredura das fichas reais mediu antes de ligar (seis arquivos, três sistemas): Ordem
 * Paranormal sai completa (18 campos, os cinco atributos, dois presets de ataque) e Oblivio também
 * (21 campos, identificação e corpo). Kids on Bikes NÃO sai — e não é defeito do leitor: aquele PDF
 * é arte achatada, sem camada de texto, com um único fragmento na página inteira. Nenhum importador
 * resolve isso sem OCR, e a tela de conferência diz que não veio nada em vez de inventar.
 *
 * Por isso a aba vai marcada como BETA (ver o rótulo em `translations.ts` e o aviso em
 * `SheetImportModal`): o que é lido, é lido bem; o que não é, é dito na cara.
 */
export const IMPORTACAO_DE_FICHA_LIGADA = true
