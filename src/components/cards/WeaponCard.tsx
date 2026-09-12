import type { WeaponCardDefinition } from '../../game/definitions/types'
import { PlayerCard, type PlayerCardProps } from './PlayerCard'

type WeaponCardProps = Omit<PlayerCardProps, 'definition'> & {
	definition: WeaponCardDefinition
}

export function WeaponCard(props: WeaponCardProps) {
	return <PlayerCard {...props} />
}
