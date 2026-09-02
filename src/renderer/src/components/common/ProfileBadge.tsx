import type { Profile } from '@shared/types/profile'
import './ProfileBadge.css'

/**
 * O CRACHÁ do personagem ativo: fotinha quadrada (avatar, como na Steam) e o nome, sem ser um controle.
 *
 * Pedido do usuário: "manter a troca de perfis apenas na Ficha, tirar das Anotações, mas colocar
 * tipo fotinha – nome e sobrenome". Ou seja, a TROCA acontece num lugar só (a aba Ficha, que é o
 * que o personagem É), e as Anotações só lembram de quem se trata — o diário de quem.
 *
 * Ele também morou ao lado do ROLAR, na tela de rolagem, até 02/09/2026 — "tirar o nome e foto de
 * perfil do lado do rolar e deixar apenas no HUD". Lá, quem diz de quem são os dados é o HUD sobre
 * a cena (`HudDoPersonagem`), que já tinha retrato e nome; o crachá era a mesma informação duas
 * vezes na mesma tela.
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
}

export function ProfileBadge({ profile, fallbackName, emptyPhotoLabel }: ProfileBadgeProps) {
  const nome = profile.name || fallbackName
  return (
    <div className="profile-badge" title={profile.system ? `${nome} (${profile.system})` : nome} data-testid="profile-badge">
      {profile.photo ? (
        <img className="profile-badge-photo" src={profile.photo} alt="" draggable={false} />
      ) : (
        <span className="profile-badge-photo profile-badge-photo-empty">{emptyPhotoLabel}</span>
      )}
      <span className="profile-badge-name">{nome}</span>
    </div>
  )
}
