<script lang="ts">
	import { Switch } from './switch';
	
	// Props - maintain backward compatibility
	let { id = '', checked = $bindable(false) } = $props();
	
	// Handle change event for backward compatibility
	function handleChange(newChecked: boolean) {
		checked = newChecked;
	}
</script>

<Switch bind:checked onCheckedChange={handleChange} {id} />
