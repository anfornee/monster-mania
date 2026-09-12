import type { PlayerCardDefinition } from '../../game/definitions/types'
import { ActionCard } from './ActionCard'
import type { PlayerCardProps } from './PlayerCard'
import { UltimateWeaponCard } from './UltimateWeaponCard'
import { WeaponCard } from './WeaponCard'

type PlayerCardRendererProps = Omit<PlayerCardProps, 'definition'> & {
	definition: PlayerCardDefinition
}

export function PlayerCardRenderer({ definition, ...props }: PlayerCardRendererProps) {
	switch (definition.category) {
		case 'action':
			return <ActionCard definition={definition} {...props} />
		case 'weapon':
			return <WeaponCard definition={definition} {...props} />
		case 'ultimate-weapon':
			return <UltimateWeaponCard definition={definition} {...props} />
	}
}
