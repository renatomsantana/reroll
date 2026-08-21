/**
 * O CAMPO DO MODIFICADOR — o "+2" e o "-1" que se soma ao resultado da rolagem.
 *
 * Isto mora em `shared` porque o campo existe em TRÊS lugares: a barra de rolagem 3D, o editor de
 * presets e o roller do modo compacto. E existir em três lugares foi exatamente o problema: os três
 * tinham a mesma linha copiada, com o mesmo defeito.
 *
 * O DEFEITO, relatado pelo usuário: não dava para digitar modificador NEGATIVO. Os campos eram
 * `<input type="number">` guardando `Number(valor) || 0`, e digitar o sinal de menos dava
 * `Number('-')` = `NaN`, que virava zero na mesma tecla — o traço sumia antes de dar tempo de
 * escrever o algarismo. Num app de RPG isso é meio caminho perdido: metade das rolagens de ficha tem
 * penalidade.
 *
 * A causa é conceitual, e é por isso que a correção não é um `if`: o estado guardava o NÚMERO, e
 * número não tem como representar "a pessoa digitou o sinal e ainda não digitou o resto". Texto tem.
 * Por isso o estado dos três campos passou a ser texto, e o número é derivado.
 */

/**
 * Teto do modificador. ±999 cobre com folga qualquer bônus de ficha de RPG, e existe para o campo
 * não aceitar um número de doze dígitos que estoura o layout e não quer dizer nada.
 */
export const MODIFICADOR_MAXIMO = 999

/**
 * O que o campo aceita ENQUANTO se digita — inclusive o que ainda não é número.
 *
 * `-`, `+` e o campo vazio são passagem, não destino: são o caminho obrigatório para chegar num
 * valor que é número. Recusá-los é recusar a digitação inteira, que era o defeito.
 */
export function textoDeModificadorAceito(bruto: string): boolean {
  return /^[+-]?\d{0,3}$/.test(bruto)
}

/** Quanto um texto de modificador vale. Estado incompleto (`-`, `+`, vazio) vale zero. */
export function modificadorDoTexto(texto: string): number {
  const n = Number(texto)
  return Number.isFinite(n) ? n : 0
}

/**
 * Soma `delta` ao modificador, respeitando o teto. Devolve o TEXTO, que é o estado do campo.
 *
 * Funciona a partir de um estado incompleto de propósito: a pessoa digita o traço, muda de ideia e
 * clica no "+". Sem isso, o `NaN` viraria a string "NaN" dentro do campo e nada mais funcionaria.
 */
export function textoDoModificadorAjustado(texto: string, delta: number): string {
  const proximo = modificadorDoTexto(texto) + delta
  return String(Math.max(-MODIFICADOR_MAXIMO, Math.min(MODIFICADOR_MAXIMO, proximo)))
}
