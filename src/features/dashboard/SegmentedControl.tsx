interface SegmentedControlProps<T extends string> {
	value: T;
	options: Array<{ value: T; label: string }>;
	onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
	return (
		<div className="inline-flex rounded-md border border-neutral-800 p-1">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => onChange(option.value)}
					className={`rounded px-3 py-1 text-sm ${
						value === option.value ? "bg-neutral-100 text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
