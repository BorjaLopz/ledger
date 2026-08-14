interface LedgerLogoProps {
	className?: string;
}

export function LedgerLogo({ className = "h-5 w-5" }: LedgerLogoProps) {
	return (
		<svg viewBox="0 0 100 100" className={className} aria-hidden="true">
			<path
				d="M28,12 L88,12 L88,72 A16,16 0 0 1 72,88 L28,88 A16,16 0 0 1 12,72 L12,28 A16,16 0 0 1 28,12 Z"
				fill="#2b2d31"
			/>
			<polygon points="62,12 88,12 88,38" fill="oklch(53% 0.24 25)" />
			<g fill="#ffffff">
				<rect x="37" y="32" width="10" height="36" />
				<rect x="37" y="58" width="26" height="10" />
			</g>
		</svg>
	);
}
