import type { ActionCardDefinition } from '../../game/definitions/types'
import { PlayerCard, type PlayerCardProps } from './PlayerCard'

type ActionCardProps = Omit<PlayerCardProps, 'definition'> & {
	definition: ActionCardDefinition
}

export function ActionCard(props: ActionCardProps) {
	return <PlayerCard {...props} />
}
