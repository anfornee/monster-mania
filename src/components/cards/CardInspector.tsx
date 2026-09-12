import { useEffect, useRef } from 'react'

export interface InspectableCard {
	name: string
	assetPath: string
	description: string
	meta?: string
	playLabel?: string
	onPlay?: () => void
}

interface CardInspectorProps {
	card: InspectableCard | null
	onClose: () => void
}

export function CardInspector({ card, onClose }: CardInspectorProps) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const restoreFocusRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return
		if (card && !dialog.open) {
			restoreFocusRef.current = document.activeElement as HTMLElement | null
			dialog.showModal()
		} else if (!card && dialog.open) {
			dialog.close()
		}
	}, [card])

	const close = () => {
		if (dialogRef.current?.open) {
			dialogRef.current.close()
		} else {
			onClose()
		}
	}

	return (
		<dialog
			ref={dialogRef}
			className="card-inspector"
			aria-labelledby="card-inspector-title"
			onCancel={(event) => {
				event.preventDefault()
				close()
			}}
			onClose={() => {
				onClose()
				window.setTimeout(() => restoreFocusRef.current?.focus(), 0)
			}}
		>
			{card ? (
				<div className="inspector-layout">
					<img src={card.assetPath} alt={`${card.name} card`} draggable={false} />
					<div className="inspector-copy">
						<span className="eyebrow">Card inspection</span>
						<h2 id="card-inspector-title">{card.name}</h2>
						{card.meta ? <p className="inspector-meta">{card.meta}</p> : null}
						<p>{card.description}</p>
						<div className="inspector-actions">
							{card.onPlay ? (
								<button
									type="button"
									className="primary-button"
									onClick={() => {
										card.onPlay?.()
										close()
									}}
								>
									{card.playLabel ?? 'Play card'}
								</button>
							) : null}
							<button type="button" className="secondary-button" onClick={close} autoFocus>
								Close
							</button>
						</div>
					</div>
				</div>
			) : null}
		</dialog>
	)
}
