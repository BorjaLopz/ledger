interface LedgerLogoProps {
	className?: string;
}

export function LedgerLogo({ className = "h-5 w-5" }: LedgerLogoProps) {
	return (
		<svg viewBox="0 0 32 32" className={className} aria-hidden="true">
			<rect width="32" height="32" rx="7" fill="#171717" />
			<path d="M9 7v18h18" fill="none" stroke="#f5f5f5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
			<path
				d="M9.5 18.5l5-6 4 3.5 6.5-8.5"
				fill="none"
				stroke="#3987e5"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
