import type { Profile } from '@shared/types/profile'
import { fichaEstaVazia } from '@shared/types/notes'

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
 * ele não quer. Importar é nascer um personagem; quem quiser o de antes, tem o de antes.
 *
 * A ÚNICA exceção (06/09/2026): o personagem aberto está EM BRANCO — sem nome, sem uma letra na
 * ficha. É o que "Novo personagem" acaba de criar, e a Ficha dele convida a importar. Criar OUTRO
 * a partir daí deixava o em branco pra trás: os dados dele tinham dois personagens sem nome, cada
 * um nascido segundos antes de uma ficha importada. Nos testadores, com teto de 3, "Novo
 * personagem" + "Importar ficha" gastava DOIS lugares. Não há o que perder num personagem em
 * branco, então a ficha entra NELE, e sem o "tem certeza?" (que avisa de um personagem novo que
 * não vai nascer). O teto de personagens é cobrado por quem chama (ver `MAX_PROFILES`), e só quando
 * a importação cria.
 *
 * Funções PURAS, sem React, pra dar pra testar cada regra com um objeto escrito à mão.
 */

export interface DestinoDaImportacao {
  characterName: string
  /** O personagem em branco que recebe a ficha; ausente, o processo principal cria um novo. */
  targetProfileId?: string
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
 * O personagem está EM BRANCO: sem nome e sem uma letra na ficha (ver `fichaEstaVazia`). É o
 * estado do recém-criado, e é o único em que importar não cria outro. Foto, diário e barras não
 * contam: a importação não apaga nenhum deles (a foto só entra se a ficha trouxer retrato).
 */
export function personagemEmBranco(
  perfil: Pick<Profile, 'name'> | undefined,
  notes: Parameters<typeof fichaEstaVazia>[0]
): boolean {
  return !!perfil && !perfil.name.trim() && fichaEstaVazia(notes)
}

/**
 * O NOME do personagem: o que o leitor achou; sem isso, o nome do arquivo. Nunca vazio: um
 * personagem sem nome vira "Personagem N" e não diz de que ficha veio.
 *
 * E o DESTINO: o personagem aberto, quando está em branco; senão, nenhum (nasce um novo).
 */
export function escolherDestino(entrada: {
  nomeLido: string
  fileName: string
  aberto?: { id: string; emBranco: boolean }
}): DestinoDaImportacao {
  const nome = entrada.nomeLido.trim()
  const characterName = nome || nomeDoArquivo(entrada.fileName)
  if (entrada.aberto?.emBranco) return { characterName, targetProfileId: entrada.aberto.id }
  return { characterName }
}
