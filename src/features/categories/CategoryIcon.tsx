import { MoreHorizontal } from "lucide-react";
import { ICONS } from "./iconRegistry";

interface CategoryIconProps {
	icon: string;
	color: string;
	className?: string;
}

export function CategoryIcon({ icon, color, className }: CategoryIconProps) {
	const Icon = ICONS[icon] ?? MoreHorizontal;
	return <Icon color={color} className={className} />;
}
