<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import * as Dialog from "./index.js";
	import { cn, flyAndScale } from "$lib/utils.js";

	let className: string | undefined | null = undefined;
	export { className as class };
	export let transition: DialogPrimitive.ContentProps["transition"] = flyAndScale;
	export let transitionConfig: DialogPrimitive.ContentProps["transitionConfig"] = undefined;
</script>

<Dialog.Portal>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		{transition}
		{transitionConfig}
		class={cn(
			"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
			className
		)}
		{...$$restProps}
	>
		<slot />
		<Dialog.Close
			class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="size-4"
			>
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
			<span class="sr-only">Close</span>
		</Dialog.Close>
	</DialogPrimitive.Content>
</Dialog.Portal>
