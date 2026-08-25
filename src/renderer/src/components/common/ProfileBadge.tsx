import type { Profile } from '@shared/types/profile'
import './ProfileBadge.css'

/**
 * O CRACHÁ do personagem ativo: fotinha quadrada (avatar, como na Steam) e o nome, sem ser um controle.
 *
 * Pedido do usuário: "manter a troca de perfis apenas na Ficha, tirar das Anotações, mas colocar
 * tipo fotinha – nome e sobrenome; e em Rolagem colocar também uma mini fotinha e nome". Ou seja,
 * a TROCA acontece num lugar só (a aba Ficha, que é o que o personagem É), e as outras abas só
 * lembram de quem se trata — o diário de quem, os dados de quem.
 *
 * É de leitura mesmo: nada de clique, nada de seta. Um crachá que abrisse a lista seria o seletor
 * de novo com outra cara, e o usuário acabou de pedir pra ele sair daqui. A foto reaproveita a
 * moldura das miniaturas do seletor (degrau pra dentro, recorte quadrado — ver `ProfileSelect.css`),
 * pra ser reconhecida como a mesma foto em qualquer aba.
 */
interface ProfileBadgeProps {
  profile: Profile
  /** Nome mostrado quando o personagem ainda não tem um — "Personagem 2", pela posição. */
  fallbackName: string
  emptyPhotoLabel: string
  /**
   * Onde o crachá está. Nas Anotações a foto é a miniatura do seletor (32×32); na barra de
   * rolagem ela cresce até a altura do botão ROLAR (39×52) — pedido do usuário ("aumenta a imagem
   * da rolagem"), medido: o corpo da caixa "Rolagem" tem 57 px, então 52 cabe sem empurrar nada.
   */
  variant?: 'notes' | 'roll'
}

export function ProfileBadge({ profile, fallbackName, emptyPhotoLabel, variant = 'notes' }: ProfileBadgeProps) {
  const nome = profile.name || fallbackName
  return (
    <div
      className={`profile-badge ${variant === 'roll' ? 'profile-badge-roll' : ''}`}
      title={profile.system ? `${nome} — ${profile.system}` : nome}
      data-testid="profile-badge"
    >
      {profile.photo ? (
        <img className="profile-badge-photo" src={profile.photo} alt="" draggable={false} />
      ) : (
        <span className="profile-badge-photo profile-badge-photo-empty">{emptyPhotoLabel}</span>
      )}
      <span className="profile-badge-name">{nome}</span>
    </div>
  )
}
