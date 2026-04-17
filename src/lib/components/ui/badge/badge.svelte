<script lang="ts" module>
	import { tv } from "tailwind-variants";
	
	export const badgeVariants = tv({
		base: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
				outline: "text-foreground",
				success: "border-transparent bg-green-500 text-white hover:bg-green-500/80",
				warning: "border-transparent bg-amber-500 text-white hover:bg-amber-500/80"
			}
		},
		defaultVariants: {
			variant: "default"
		}
	});
</script>

<script lang="ts">
	import type { VariantProps } from "tailwind-variants";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";

	type Variant = VariantProps<typeof badgeVariants>["variant"];
	
	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: Variant;
		children?: Snippet;
	}
	
	let {
		class: className,
		variant = "default",
		children,
		...restProps
	}: Props = $props();
</script>

<div class={cn(badgeVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</div>
