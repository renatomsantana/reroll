import type { Profile } from '@shared/types/profile'
import './ProfileBadge.css'

/**
 * O CRACHÁ do personagem ativo: fotinha 3×4 e o nome, sem ser um controle.
 *
 * Pedido do usuário: "manter a troca de perfis apenas na Ficha, tirar das Anotações, mas colocar
 * tipo fotinha – nome e sobrenome; e em Rolagem colocar também uma mini fotinha e nome". Ou seja,
 * a TROCA acontece num lugar só (a aba Ficha, que é o que o personagem É), e as outras abas só
 * lembram de quem se trata — o diário de quem, os dados de quem.
 *
 * É de leitura mesmo: nada de clique, nada de seta. Um crachá que abrisse a lista seria o seletor
 * de novo com outra cara, e o usuário acabou de pedir pra ele sair daqui. A foto reaproveita a
 * moldura das miniaturas do seletor (degrau pra dentro, recorte 3×4 — ver `ProfileSelect.css`),
 * pra ser reconhecida como a mesma foto em qualquer aba.
 */
interface ProfileBadgeProps {
  profile: Profile
  /** Nome mostrado quando o personagem ainda não tem um — "Personagem 2", pela posição. */
  fallbackName: string
  emptyPhotoLabel: string
  /** A versão MINI, da barra de rolagem: foto de 18×24 e fonte menor. */
  mini?: boolean
}

export function ProfileBadge({ profile, fallbackName, emptyPhotoLabel, mini = false }: ProfileBadgeProps) {
  const nome = profile.name || fallbackName
  return (
    <div
      className={`profile-badge ${mini ? 'profile-badge-mini' : ''}`}
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
