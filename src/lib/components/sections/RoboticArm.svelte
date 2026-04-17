<script lang="ts">
	import { Archive, Download } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<Card.Title>Robotic Arm</Card.Title>
	</Card.Header>
	<Card.Content class=" space-y-3">
		<!-- NOT IMPLEMENTED: Backend does not handle ARM commands yet -->
		<Button 
			variant="default"
			class="w-full"
			onclick={() => console.log('Drop in storage (not implemented)')}
		>
			<Archive class="w-4 h-4 mr-2" />Drop in Storage Box
		</Button>
		<Button 
			variant="secondary"
			class="w-full"
			onclick={() => console.log('Drop outside (not implemented)')}
		>
			<Download class="w-4 h-4 mr-2" />Drop Outside Rover
		</Button>
	</Card.Content>
</Card.Root>
