import type { VariantProps } from "tailwind-variants";
import type { HTMLAttributes } from "svelte/elements";
import Root from "./badge.svelte";
import { badgeVariants } from "./badge.svelte";

type Variant = VariantProps<typeof badgeVariants>["variant"];
type Props = HTMLAttributes<HTMLDivElement> & {
	variant?: Variant;
};

export {
	Root,
	type Props,
	//
	Root as Badge,
	type Props as BadgeProps,
	badgeVariants
};
