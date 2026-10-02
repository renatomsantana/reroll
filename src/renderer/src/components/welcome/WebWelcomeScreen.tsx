import { appIconImage } from '../../assets/icons'
import { WelcomeDie3D } from './WelcomeDie3D'
import './WebWelcomeScreen.css'

interface WebWelcomeScreenProps {
  appIconId: string
  onEnterBoard: () => void
}

const LETRAS_DO_REROLL = ['R', 'e', 'r', 'o', 'l', 'l']

/** Tela curta exibida apenas na primeira visita à versão hospedada do Reroll. */
export function WebWelcomeScreen({ appIconId, onEnterBoard }: WebWelcomeScreenProps) {
  return (
    <main className="web-welcome" aria-labelledby="web-welcome-title">
      <section className="web-welcome-window">
        <div className="web-welcome-titlebar">
          <img className="web-welcome-titlebar-icon" src={appIconImage(appIconId)} alt="" />
          Reroll
        </div>
        <div className="web-welcome-content">
          <div className="web-welcome-visual" aria-hidden="true">
            <div className="web-welcome-die-stage">
              <WelcomeDie3D />
            </div>
          </div>
          <div className="web-welcome-copy-area">
            <h1 id="web-welcome-title" className="web-welcome-wordmark" aria-label="Reroll">
              {LETRAS_DO_REROLL.map((letra, indice) => (
                <span key={`${letra}-${indice}`} style={{ '--letter-index': indice } as React.CSSProperties}>
                  {letra}
                </span>
              ))}
            </h1>
            <p className="web-welcome-copy">Seu rolador de dados,<br />do jeitinho que você quer.</p>
            <p className="web-welcome-detail">
              Seu tabuleiro fica salvo<br />neste navegador.
            </p>
            <button className="web-welcome-action" type="button" onClick={onEnterBoard} autoFocus>
              Vá para seu tabuleiro
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
