/**
 * As DECISÕES da importação de ficha, tomadas pelo app — e não perguntadas.
 *
 * Pedido dele (02/09/2026): "não precisa perguntar para a pessoa e mostrar aquela página inteira de
 * ficha, apenas upload, scrap tudo, e deixa editável para o user". A janela de importação (que já
 * tinha encolhido de conferência campo a campo pra um "ok, importaremos") saiu por inteiro. O que
 * ela ainda perguntava — o nome, quando o leitor não achou; o destino, novo ou o aberto — agora é
 * decidido aqui, por regra, e tudo continua editável na aba Ficha depois.
 *
 * Funções PURAS, sem React, pra dar pra testar cada regra com um objeto escrito à mão.
 */

interface PerfilResumido {
  id: string
  name: string
}

export interface DestinoDaImportacao {
  /** O personagem que recebe a ficha, ou `undefined` pra criar um novo. */
  targetProfileId?: string
  characterName: string
  /** `true` quando a ficha caiu por cima de um personagem que já tinha ficha (a reimportação). */
  atualizou: boolean
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
 * PRA ONDE a ficha vai, em três regras, nesta ordem:
 *
 * 1. A ficha do personagem ABERTO está vazia (o "Novo personagem" recém-criado, ou a tela de
 *    convite "esta ficha está vazia"): a importação preenche ELE. É o que a pessoa acabou de pedir
 *    ao clicar em importar naquela ficha, e não estraga nada.
 * 2. Já existe um personagem com o MESMO NOME que a ficha traz: a importação ATUALIZA esse. É a
 *    reimportação depois de subir de nível, e criar um segundo "Kieran" deixaria dois iguais sem
 *    nada dizendo qual é qual — e apagar um levaria o diário junto.
 * 3. Senão, um personagem NOVO. Quem cobra o teto de personagens é quem chama (ver `MAX_PROFILES`).
 *
 * O NOME: o que o leitor achou; sem isso, o que o personagem atualizado já tinha; sem isso, o nome
 * do arquivo. Nunca vazio: um personagem sem nome vira "Personagem N" e não diz de que ficha veio.
 */
export function escolherDestino(entrada: {
  nomeLido: string
  fileName: string
  perfis: PerfilResumido[]
  ativo: PerfilResumido
  fichaDoAtivoVazia: boolean
}): DestinoDaImportacao {
  const nome = entrada.nomeLido.trim()
  if (entrada.fichaDoAtivoVazia) {
    return {
      targetProfileId: entrada.ativo.id,
      characterName: nome || entrada.ativo.name.trim() || nomeDoArquivo(entrada.fileName),
      atualizou: false
    }
  }
  if (nome) {
    const mesmo = entrada.perfis.find((perfil) => perfil.name.trim().toLowerCase() === nome.toLowerCase())
    if (mesmo) return { targetProfileId: mesmo.id, characterName: nome, atualizou: true }
  }
  return { characterName: nome || nomeDoArquivo(entrada.fileName), atualizou: false }
}
