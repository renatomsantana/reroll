/**
 * O QUE ESTÁ PRONTO NA `main` MAS AINDA NÃO VAI PROS TESTADORES.
 *
 * Ele libera uma coisa de cada vez pra receber feedback de uma coisa de cada vez (foi assim com a Ficha
 * beta, com o teto de três personagens, e é assim com o HUD). O código fica inteiro na `main`, testado
 * e instalado na máquina dele; o que muda entre a `main` e o branch `lancamento` é SÓ o valor daqui.
 */

/**
 * O HUD do personagem sobre a cena (spec §3.6): retrato, nome, as barras de PV/PE/Sanidade
 * (spec §3.4), as condições e o Descansar (§3.8). Desligado, some o cartão da cena, somem as
 * barras finas do modo compacto (e a janelinha não cresce por barra) e a conferência da
 * importação não propõe barras — mas as barras que a ficha traz continuam GRAVADAS no
 * `notes.json`, só não aparecem: no dia em que o HUD for liberado, elas já estão lá.
 */
export const HUD_LIBERADO = true

/**
 * Duas linhas das Preferências GUARDADAS a pedido dele (05/09/2026: "tira o como resultado aparece,
 * deixa aí se nós quiser outro dia mas tira por agora"; "e tira o copiar com negrito markdown"):
 * o seletor "Como o resultado aparece" (bandeja 3D ou número na hora) e o "Copiar com negrito
 * (Markdown)". As preferências continuam existindo e valendo com o valor que têm (`displayMode`
 * padrão `3d`, `copyMarkdown` padrão ligado; o modo rápido continua sendo a rede de quem não tem
 * WebGL, ver `webglDisponivel.ts`) — só a linha no painel some. Virar pra `true` traz de volta.
 */
export const SELETOR_DE_RESULTADO_NAS_PREFERENCIAS = false
export const COPIAR_COM_NEGRITO_NAS_PREFERENCIAS = false

/**
 * Mais três guardadas na mesma hora ("tira o clarão de crítico e falha e som de crítico e falha,
 * também tira o som ativado ou desativado"): os interruptores do clarão e do som de crítico (os
 * efeitos seguem LIGADOS, só sem botão) e o Ativado/Desativado do som. Sem este último, a
 * barrinha de volume é o controle de som (zero é mudo), e mexer nela religa o som de quem o
 * tinha desligado antes, pra ninguém ficar mudo sem botão pra sair.
 */
export const CRITICO_NAS_PREFERENCIAS = false
export const INTERRUPTOR_DE_SOM_NAS_PREFERENCIAS = false

/**
 * PERSONAGENS À VONTADE, a regra do dono: "EU o DONO posso ter quantos personagens quiser, OS OUTROS
 * usuários apenas 3, eles são bloqueados e recebem um aviso".
 *
 * Ligado (a `main`, o cliente dele): o teto de criação é o do disco. Desligado (o branch `lancamento`):
 * o teto volta a TRÊS, duro, com o botão "Novo personagem" avisando pelo diálogo do app e a importação
 * travando o OK com o mesmo motivo. Quem decide o valor é `MAX_PROFILES`, derivado daqui.
 */
export const PERSONAGENS_LIBERADOS = true
