interface CardBackProps {
	count?: number
	label?: string
}

export function CardBack({ count = 1, label = 'Hidden card' }: CardBackProps) {
	return (
		<span className="card-back-stack" aria-label={`${count} ${label}${count === 1 ? '' : 's'}`}>
			<img src="/assets/cards/card-back.png" alt="" draggable={false} />
			{count > 1 ? <strong>{count}</strong> : null}
		</span>
	)
}
