<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	
	// Mission state
	let stage = $state<'maintenance' | 'deployment'>('maintenance');
	let tasksCompleted = $state<string[]>([]);
	let codeSubmitted = $state('');
	
	const maintenanceTasks = [
		{ id: 'cache', name: 'Cache Handling' },
		{ id: 'drawer', name: 'Drawer Operations' },
		{ id: 'buttons', name: 'Push Buttons' },
		{ id: 'switches', name: 'Flip Switches' },
		{ id: 'knobs', name: 'Turn Knobs' },
		{ id: 'joystick', name: 'Operate Joystick' },
		{ id: 'latches', name: 'Undo Latches' },
		{ id: 'panels', name: 'Open Panels' },
		{ id: 'plug', name: 'Connect Plug' }
	];
	
	function toggleTask(taskId: string) {
		if (tasksCompleted.includes(taskId)) {
			tasksCompleted = tasksCompleted.filter(id => id !== taskId);
		} else {
			tasksCompleted = [...tasksCompleted, taskId];
		}
	}
</script>

<div class="idmo-mission space-y-6">
	<!-- Mission Stage -->
	<Card>
		<CardHeader>
			<CardTitle>Mission Stage</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-4">
				<div class="stage-buttons">
					<button 
						class="stage-btn"
						class:active={stage === 'maintenance'}
						onclick={() => stage = 'maintenance'}
					>
						Stage 1: Maintenance
					</button>
					<button 
						class="stage-btn"
						class:active={stage === 'deployment'}
						onclick={() => stage = 'deployment'}
					>
						Stage 2: Deployment
					</button>
				</div>
				
				<div class="progress-bar-container">
					<div class="progress-label">
						<span>Tasks Completed</span>
						<span class="progress-count">{tasksCompleted.length}/{maintenanceTasks.length}</span>
					</div>
					<div class="progress-bar">
						<div 
							class="progress-fill" 
							style="width: {(tasksCompleted.length / maintenanceTasks.length) * 100}%"
						></div>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>
	
	{#if stage === 'maintenance'}
		<!-- Maintenance Tasks -->
		<Card>
			<CardHeader>
				<CardTitle>Instrument Maintenance Tasks</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="tasks-grid">
					{#each maintenanceTasks as task}
						<button
							class="task-card"
							class:completed={tasksCompleted.includes(task.id)}
							onclick={() => toggleTask(task.id)}
						>
							<span class="task-name">{task.name}</span>
						</button>
					{/each}
				</div>
			</CardContent>
		</Card>
		
		<!-- Panel Controls -->
		<Card>
			<CardHeader>
				<CardTitle>Panel Controls</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<div class="control-info">
						<span class="info-label">Panel Height:</span>
						<Badge>Max 1.5m</Badge>
					</div>
					
					<button class="btn btn-primary w-full">
						Operate Panel Controls
					</button>
					
					<button class="btn btn-secondary w-full">
						Measure Distance
					</button>
				</div>
			</CardContent>
		</Card>
	{:else}
		<!-- Deployment Stage -->
		<Card>
			<CardHeader>
				<CardTitle>Component Deployment</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<button class="btn btn-primary w-full">
						Retrieve Components
					</button>
					
					<button class="btn btn-secondary w-full">
						Navigate to Deployment Location
					</button>
					
					<button class="btn btn-secondary w-full">
						Deploy in Pattern
					</button>
					
					<div class="deployment-status">
						<div class="status-item">
							<span>Components Retrieved:</span>
							<Badge variant="secondary">0/3</Badge>
						</div>
						<div class="status-item">
							<span>Components Deployed:</span>
							<Badge variant="secondary">0/3</Badge>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
		
		<!-- Code Reading -->
		<Card>
			<CardHeader>
				<CardTitle>Code Reading & Submission</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<div class="code-input-container">
						<label for="code-input" class="code-label">Read Code from Panel/Components:</label>
						<input 
							id="code-input"
							type="text" 
							class="code-input"
							bind:value={codeSubmitted}
							placeholder="Enter code here..."
						/>
					</div>
					
					<button class="btn btn-primary w-full" disabled={!codeSubmitted}>
						Submit Code to Judges
					</button>
					
					{#if codeSubmitted}
						<div class="code-display">
							<strong>Code to Submit:</strong>
							<span class="code-value">{codeSubmitted}</span>
						</div>
					{/if}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>

<style>
	.stage-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	
	.stage-btn {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		color: var(--slate-300);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}
	
	.stage-btn:hover {
		background: var(--slate-700);
		border-color: var(--sky-blue);
	}
	
	.stage-btn.active {
		background: var(--sky-blue);
		border-color: var(--sky-blue);
		color: white;
	}
	
	.progress-bar-container {
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
	}
	
	.progress-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		color: var(--slate-300);
	}
	
	.progress-count {
		font-weight: 700;
		color: var(--sky-light);
		font-family: 'Courier New', monospace;
	}
	
	.progress-bar {
		width: 100%;
		height: 8px;
		background: var(--slate-700);
		border-radius: 999px;
		overflow: hidden;
	}
	
	.progress-fill {
		height: 100%;
		background: var(--sky-blue);
		transition: width 0.3s ease;
	}
	
	.tasks-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
	}
	
	.task-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s;
	}
	
	.task-card:hover {
		background: var(--slate-700);
		border-color: var(--sky-blue);
	}
	
	.task-card.completed {
		background: var(--green);
		border-color: var(--green);
		color: white;
	}
	
	.task-name {
		font-size: 0.875rem;
		text-align: center;
		color: var(--slate-300);
		font-weight: 500;
	}
	
	.task-card.completed .task-name {
		color: white;
	}
	
	.control-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 0.375rem;
	}
	
	.info-label {
		font-size: 0.875rem;
		color: var(--slate-400);
	}
	
	.deployment-status {
		margin-top: 1rem;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: var(--slate-300);
	}
	
	.code-input-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.code-label {
		font-size: 0.875rem;
		color: var(--slate-300);
		font-weight: 500;
	}
	
	.code-input {
		width: 100%;
		padding: 0.75rem;
		background: var(--slate-800);
		border: 2px solid var(--slate-600);
		border-radius: 0.5rem;
		color: white;
		font-family: 'Courier New', monospace;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	
	.code-input:focus {
		outline: none;
		border-color: var(--sky-blue);
		box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
	}
	
	.code-display {
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--sky-blue);
		border-radius: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.code-display strong {
		font-size: 0.875rem;
		color: var(--slate-400);
	}
	
	.code-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--sky-light);
		font-family: 'Courier New', monospace;
		letter-spacing: 0.1em;
	}
</style>
