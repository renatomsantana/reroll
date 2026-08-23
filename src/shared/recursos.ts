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
 * CHEGOU A SER LIGADO, e voltou a DESLIGADO — decisão do usuário depois de olhar a importação
 * rodando: "ainda tem muitos erros para todas as informações".
 *
 * O motivo, medido: o que o leitor traz está CERTO (os 18 campos de Ordem Paranormal batem campo a
 * campo com o arquivo; os 23 de Oblivio também, já com o equipamento), mas ele ainda deixa
 * informação de fora — os valores ATUAIS de PV, PE e Sanidade, entre outros. Uma ficha importada
 * pela metade é pior que uma ficha em branco: a pessoa confia no que está na tela e não confere o
 * que ficou faltando.
 *
 * Continua tudo escrito e testado (os leitores, a tela de conferência, os canais de IPC), e a
 * suíte cobre inclusive os defeitos consertados nesta rodada. O que está desligado é a PORTA: o
 * botão de importar e os dois canais que ele usa. Ligar de novo é trocar pra `true`.
 */
export const IMPORTACAO_DE_FICHA_LIGADA = false
