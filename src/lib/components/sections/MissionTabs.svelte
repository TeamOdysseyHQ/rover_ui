<script lang="ts">
	interface Props {
		activeMission?: string;
		onMissionChange?: (mission: string) => void;
	}
	
	let { activeMission = 'general', onMissionChange = () => {} }: Props = $props();
	
	const missions = [
		{
			id: 'general',
			name: 'General',
			description: 'General rover operations'
		},
		{
			id: 'abex',
			name: 'ABEx',
			description: 'Astrobiology Expedition'
		},
		{
			id: 'rado',
			name: 'RADO',
			description: 'Reconnaissance & Autonomous Delivery'
		},
		{
			id: 'idmo',
			name: 'IDMO',
			description: 'Instrument Deployment & Maintenance'
		}
	];
	
	function handleTabClick(missionId: string) {
		onMissionChange(missionId);
	}
</script>

<nav class="mission-tabs-container mb-6">
	<div class="mission-tabs">
		{#each missions as mission}
			<button
				class="mission-tab"
				class:active={activeMission === mission.id}
				onclick={() => handleTabClick(mission.id)}
				title={mission.description}
			>
				<div class="mission-info">
					<span class="mission-name">{mission.name}</span>
					<span class="mission-desc">{mission.description}</span>
				</div>
			</button>
		{/each}
	</div>
</nav>

<style>
	.mission-tabs-container {
		background: var(--slate-900);
		border: 1px solid var(--slate-800);
		border-radius: 0.5rem;
		padding: 0.75rem;
	}
	
	.mission-tabs {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.5rem;
	}
	
	.mission-tab {
		display: flex;
		align-items: center;
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s ease;
		color: var(--slate-300);
	}
	
	.mission-tab:hover {
		background: var(--slate-700);
	}
	
	.mission-tab.active {
		background: var(--sky-blue);
		border-color: var(slate-300);
		color: white;
	}
	
	.mission-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		flex: 1;
	}
	
	.mission-name {
		font-weight: 600;
		font-size: 0.875rem;
		letter-spacing: 0.025em;
	}
	
	.mission-desc {
		font-size: 0.75rem;
		opacity: 0.7;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	
	@media (max-width: 768px) {
		.mission-tabs {
			grid-template-columns: repeat(2, 1fr);
		}
		
		.mission-desc {
			display: none;
		}
	}
</style>
