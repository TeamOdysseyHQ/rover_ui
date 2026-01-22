<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<DialogPrimitive.Overlay
	class={cn(
		"fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
		className
	)}
	{...$$restProps}
/>
