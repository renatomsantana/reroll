/**
 * O QUE ESTÁ PRONTO NA `main` MAS AINDA NÃO VAI PROS TESTADORES.
 *
 * Ele libera uma coisa de cada vez pra receber feedback de uma coisa de cada vez (foi assim com a
 * Ficha beta, com o teto de três personagens, e é assim com o HUD). O código fica inteiro na
 * `main`, testado e instalado na máquina dele; o que muda entre a `main` e o branch de lançamento
 * (`lancamento`) é SÓ o valor daqui. Quando ele mandar liberar, é virar pra `true` no branch e
 * lançar — nada pra reescrever.
 */

/**
 * O HUD do personagem sobre a cena (spec §3.6): retrato, nome, as barras de PV/PE/Sanidade
 * (spec §3.4), as condições e o Descansar (§3.8). Desligado, some o cartão da cena, somem as
 * barras finas do modo compacto (e a janelinha não cresce por barra) e a conferência da
 * importação não propõe barras — mas as barras que a ficha traz continuam GRAVADAS no
 * `notes.json`, só não aparecem: no dia em que o HUD for liberado, elas já estão lá.
 */
export const HUD_LIBERADO = true
