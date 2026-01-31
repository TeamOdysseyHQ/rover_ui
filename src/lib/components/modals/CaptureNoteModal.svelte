<script lang="ts">
	import { X, Camera, AlertCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';

	interface Props {
		isOpen?: boolean;
		cameraName?: string;
		onConfirm: (note: string) => void;
		onCancel: () => void;
	}

	let { isOpen = $bindable(false), cameraName = 'camera', onConfirm, onCancel }: Props = $props();

	let note = $state('');
	let errorMessage = $state('');

	function handleConfirm() {
		const trimmedNote = note.trim();

		if (!trimmedNote) {
			errorMessage = 'Please provide a reason for capturing this object';
			return;
		}

		onConfirm(trimmedNote);
		// Reset state
		note = '';
		errorMessage = '';
	}

	function handleCancel() {
		onCancel();
		// Reset state
		note = '';
		errorMessage = '';
	}

	// Handle Escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleCancel();
		} else if (e.key === 'Enter' && e.ctrlKey) {
			// Ctrl+Enter to submit
			handleConfirm();
		}
	}

	// Auto-focus textarea when modal opens
	let textareaElement: HTMLTextAreaElement;
	$effect(() => {
		if (isOpen && textareaElement) {
			setTimeout(() => textareaElement.focus(), 100);
		}
	});
</script>

{#if isOpen}
	<!-- Modal Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
		onkeydown={handleKeydown}
	>
		<!-- Modal Content -->
		<Card.Card class="w-full max-w-2xl bg-slate-900 border-slate-700 shadow-2xl">
			<Card.Header class="border-b border-slate-700">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Camera class="h-6 w-6 text-sky-400" />
						<div>
							<Card.Title class="text-slate-100">Object Documentation Required</Card.Title>
							<Card.Description class="text-slate-400 mt-1">
								Camera: <span class="text-sky-400 font-medium">{cameraName}</span>
							</Card.Description>
						</div>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onclick={handleCancel}
						class="text-slate-400 hover:text-slate-100 hover:bg-slate-800"
					>
						<X class="h-5 w-5" />
					</Button>
				</div>
			</Card.Header>

			<Card.Content class="p-6 space-y-4">
				<!-- Instructions -->
				<div class="flex items-start gap-3 p-4 rounded-lg bg-sky-950/30 border border-sky-800/50">
					<AlertCircle class="h-5 w-5 text-sky-400 flex-shrink-0 mt-0.5" />
					<div class="text-sm text-slate-300 leading-relaxed">
						<p class="font-medium text-slate-100 mb-1">Why are you capturing this object?</p>
						<p class="text-slate-400">
							Provide a detailed reason for documenting this object. This will be included in the
							reconnaissance report.
						</p>
					</div>
				</div>

				<!-- Textarea -->
				<div class="space-y-2">
					<label for="capture-note" class="text-sm font-medium text-slate-200">
						Object Description / Reason for Capture *
					</label>
					<textarea
						id="capture-note"
						bind:this={textareaElement}
						bind:value={note}
						placeholder="Example: Unusual rock formation with metallic appearance. Potential mineral deposit. Located at grid reference Alpha-3..."
						rows="6"
						class={cn(
							'w-full px-4 py-3 rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500',
							'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent',
							'resize-none font-mono text-sm leading-relaxed',
							errorMessage ? 'border-red-500' : 'border-slate-700'
						)}
						oninput={() => {
							errorMessage = '';
						}}
					/>
					<div class="flex justify-between items-center">
						<p class="text-xs text-slate-500">
							{note.length} characters
							{#if note.length > 500}
								<span class="text-amber-400">(Consider being more concise)</span>
							{/if}
						</p>
						<p class="text-xs text-slate-500">Tip: Press Ctrl+Enter to submit</p>
					</div>
				</div>

				<!-- Error Message -->
				{#if errorMessage}
					<div class="flex items-center gap-2 p-3 rounded-lg bg-red-950/30 border border-red-800/50">
						<AlertCircle class="h-4 w-4 text-red-400 flex-shrink-0" />
						<p class="text-sm text-red-300">{errorMessage}</p>
					</div>
				{/if}
			</Card.Content>

			<Card.Footer class="border-t border-slate-700 p-4 flex justify-end gap-3">
				<Button variant="outline" onclick={handleCancel} class="border-slate-600 text-slate-300">
					Cancel
				</Button>
				<Button
					onclick={handleConfirm}
					class="bg-sky-600 hover:bg-sky-700 text-white font-medium"
					disabled={!note.trim()}
				>
					<Camera class="h-4 w-4 mr-2" />
					Capture & Document
				</Button>
			</Card.Footer>
		</Card.Card>
	</div>
{/if}
