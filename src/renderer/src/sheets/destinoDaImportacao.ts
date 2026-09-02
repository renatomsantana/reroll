/**
 * As DECISÕES da importação de ficha, tomadas pelo app — e não perguntadas.
 *
 * Pedido dele (02/09/2026): "não precisa perguntar para a pessoa e mostrar aquela página inteira de
 * ficha, apenas upload, scrap tudo, e deixa editável para o user". A janela de importação (que já
 * tinha encolhido de conferência campo a campo pra um "ok, importaremos") saiu por inteiro.
 *
 * E, no mesmo dia, a regra do DESTINO ficou uma só: "toda vez que uploadar uma ficha nova, que
 * CRIE um personagem novo, para não perder o que já está lá". Esta função já preencheu a ficha
 * vazia do personagem aberto e já atualizou um homônimo (a reimportação depois de subir de nível);
 * as duas regras caíram porque as duas gravam POR CIMA de um personagem que existe, e é isso que
 * ele não quer. Importar agora é sempre nascer um personagem; quem quiser o de antes, tem o de
 * antes. O único "tem certeza?" é o diálogo antes de escolher o PDF (ver `useSheetImport`), e o
 * teto de personagens é cobrado por quem chama (ver `MAX_PROFILES`).
 *
 * Funções PURAS, sem React, pra dar pra testar cada regra com um objeto escrito à mão.
 */

export interface DestinoDaImportacao {
  characterName: string
}

/**
 * O nome do arquivo como nome do personagem, em ÚLTIMO caso: "Ficha Kids on Bikes - Preenchida"
 * é melhor que "Personagem 2" quando o leitor não achou nome nenhum, porque diz o que foi
 * importado — e é uma caixa de texto na Ficha, que se troca na hora.
 */
export function nomeDoArquivo(fileName: string): string {
  return fileName
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * O NOME do personagem novo: o que o leitor achou; sem isso, o nome do arquivo. Nunca vazio: um
 * personagem sem nome vira "Personagem N" e não diz de que ficha veio.
 */
export function escolherDestino(entrada: { nomeLido: string; fileName: string }): DestinoDaImportacao {
  const nome = entrada.nomeLido.trim()
  return { characterName: nome || nomeDoArquivo(entrada.fileName) }
}
