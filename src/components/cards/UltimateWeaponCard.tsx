import type { UltimateWeaponCardDefinition } from '../../game/definitions/types'
import { PlayerCard, type PlayerCardProps } from './PlayerCard'

type UltimateWeaponCardProps = Omit<PlayerCardProps, 'definition'> & {
	definition: UltimateWeaponCardDefinition
}

export function UltimateWeaponCard(props: UltimateWeaponCardProps) {
	return <PlayerCard {...props} />
}
