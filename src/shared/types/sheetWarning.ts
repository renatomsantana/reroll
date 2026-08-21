/**
 * Os AVISOS que um leitor de ficha pode dar, como identificadores em vez de frases.
 *
 * Eles eram texto pronto em português, escrito dentro de cada leitor. Isso quebrava o app pra metade
 * de quem ele atende: a interface tem inglês (ver `i18n/translations.ts`), e quem a usava em inglês
 * abria a janela de conferência e encontrava um parágrafo em português explicando o que o app não
 * tinha conseguido ler — justamente a mensagem que mais precisa ser entendida, porque é ela que
 * separa "importou vazio" de "o programa não funcionou".
 *
 * Como identificador, cada aviso é traduzido onde a tradução mora e testado por IDENTIDADE. A
 * segunda parte não é detalhe: os testes casavam a prosa com expressão regular (`/maior dado/i`),
 * então trocar uma palavra do texto quebrava teste sem nada ter mudado de comportamento, e mudar o
 * comportamento sem trocar a palavra não quebrava nada.
 *
 * PRA ACRESCENTAR UM AVISO: ponha o id aqui e o texto nos dois idiomas em `translations.ts`. O
 * TypeScript cobra as duas pontas — o dicionário é `Record<SheetWarningId, string>`, então um id
 * novo sem tradução não compila, que é o contrário do que acontecia com frase solta no meio do
 * leitor.
 */
export type SheetWarningId =
  /** PDF sem camada de texto: digitalização ou arte exportada sem texto. Não há o que extrair. */
  | 'pdf-sem-texto'
  /** Ficha sem campos preenchíveis: a leitura é palpite baseado na diagramação da página. */
  | 'sem-formulario'
  /** Tem campos preenchíveis, e todos vazios — o modelo em branco. */
  | 'formulario-vazio'
  /** Nenhum nome de personagem e nenhuma rolagem: pode ser o preenchimento de fábrica do modelo. */
  | 'sem-nome-nem-rolagem'
  /** A ficha é uma IMAGEM com o texto escrito por cima; os rótulos são desenho. */
  | 'arte-com-anotacao'
  /** Ordem Paranormal: os testes valem o MAIOR dado, e os presets já foram criados com essa regra. */
  | 'ordem-maior-dado'
  /** D&D 5e: as magias da página de conjuração não têm nome de campo pra serem lidas. */
  | 'dnd5e-magias-sem-nome'
  /** D&D 5e: nenhum nome e nenhum ataque — parece o modelo em branco baixado do site. */
  | 'dnd5e-modelo-em-branco'
