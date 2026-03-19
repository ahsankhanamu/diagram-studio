<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import { nodes, edges, updateNode, updateEdge, removeEdges, removeNodes } from '$lib/stores/diagramStore';
	import { selectedNodeIds, selectedEdgeIds, clearSelection } from '$lib/stores/selectionStore';
	import { rightPanelOpen, rightPanelWidth } from '$lib/stores/sidebarStore';
	import { nodeRegistry } from '$lib/components/nodes';
	import { pushHistory } from '$lib/stores/historyStore';
	import type { MarkerType, StrokeStyle, HandleDistributionMode } from '$lib/types/diagram';

	let selectedNode = $derived.by(() => {
		const ids = $selectedNodeIds;
		if (ids.size !== 1) return null;
		const id = ids.values().next().value;
		return $nodes.get(id!) || null;
	});

	let selectedEdge = $derived.by(() => {
		if (selectedNode) return null;
		const ids = $selectedEdgeIds;
		if (ids.size !== 1) return null;
		const id = ids.values().next().value;
		return $edges.get(id!) || null;
	});

	const multiSelected = $derived($selectedNodeIds.size > 1);

	const markerOptions: { value: MarkerType; label: string }[] = [
		{ value: 'none', label: 'None' },
		{ value: 'arrow', label: 'Arrow' },
		{ value: 'arrowclosed', label: 'Arrow (filled)' }
	];

	const strokeStyleOptions: { value: StrokeStyle; label: string }[] = [
		{ value: 'solid', label: 'Solid' },
		{ value: 'dashed', label: 'Dashed' },
		{ value: 'dotted', label: 'Dotted' }
	];

	function handleDeleteEdge() {
		if (!selectedEdge) return;
		pushHistory();
		removeEdges([selectedEdge.id]);
		clearSelection();
	}

	function handleDeleteNode() {
		if (!selectedNode) return;
		pushHistory();
		removeNodes([selectedNode.id]);
		clearSelection();
	}

	// Capture history once when the user focuses an input field.
	// All edits within the same focus session become a single undo step.
	function captureHistory() {
		pushHistory();
	}

	function updateNodeStyle(key: string, value: string) {
		if (!selectedNode) return;
		const style = { ...selectedNode.style, [key]: value };
		if (!value) delete style[key];
		updateNode(selectedNode.id, { style });
	}
</script>

{#if $rightPanelOpen}
<div
	data-panel="right"
	class="flex shrink-0 flex-col overflow-hidden border-l"
	style="width: {$rightPanelWidth}px; background: var(--color-bg-surface); border-color: var(--color-border-primary);"
>
	{#if selectedNode}
		{@const def = nodeRegistry[selectedNode.type]}

		<!-- Header -->
		<div
			class="flex items-center gap-2 border-b px-3 py-2.5"
			style="border-color: var(--color-border-subtle); background: color-mix(in srgb, var({def?.color || '--color-accent'}) 8%, var(--color-bg-surface));"
		>
			<div
				class="flex h-7 w-7 items-center justify-center rounded-md"
				style="background-color: color-mix(in srgb, var({def?.color || '--color-accent'}) 20%, transparent); color: var({def?.color || '--color-accent'});"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" />
				</svg>
			</div>
			<div class="min-w-0 flex-1">
				<span class="block truncate text-sm font-medium" style="color: var(--color-text-primary);">
					{selectedNode.label || def?.label || selectedNode.type}
				</span>
				<span class="block text-[10px]" style="color: var(--color-text-muted);">
					{def?.description || selectedNode.type}
				</span>
			</div>
		</div>

		<!-- Properties form -->
		<div class="flex-1 space-y-4 overflow-y-auto p-3">
			<!-- Label -->
			<div>
				<label class="mb-1 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">
					Label
				</label>
				<input
					value={selectedNode.label}
					onfocus={captureHistory}
					oninput={(e) => updateNode(selectedNode!.id, { label: (e.target as HTMLInputElement).value })}
					class="h-8 w-full rounded-md border px-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
					style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
				/>
			</div>

			<!-- Description -->
			<div>
				<label class="mb-1 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">
					Description
				</label>
				<textarea
					value={selectedNode.description}
					onfocus={captureHistory}
					oninput={(e) => updateNode(selectedNode!.id, { description: (e.target as HTMLTextAreaElement).value })}
					rows="3"
					class="w-full resize-none rounded-md border px-2.5 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
					style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
				></textarea>
			</div>

			<!-- Position -->
			<div>
				<label class="mb-1 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">
					Position
				</label>
				<div class="grid grid-cols-2 gap-2">
					<div class="flex items-center gap-1.5 rounded-md border px-2"
						style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary);">
						<span class="text-[10px] font-medium" style="color: var(--color-text-muted);">X</span>
						<input
							type="number"
							value={Math.round(selectedNode.position.x)}
							onfocus={captureHistory}
							oninput={(e) => updateNode(selectedNode!.id, { position: { ...selectedNode!.position, x: Number((e.target as HTMLInputElement).value) } })}
							class="h-7 w-full border-none bg-transparent text-xs outline-none"
							style="color: var(--color-text-primary);"
						/>
					</div>
					<div class="flex items-center gap-1.5 rounded-md border px-2"
						style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary);">
						<span class="text-[10px] font-medium" style="color: var(--color-text-muted);">Y</span>
						<input
							type="number"
							value={Math.round(selectedNode.position.y)}
							onfocus={captureHistory}
							oninput={(e) => updateNode(selectedNode!.id, { position: { ...selectedNode!.position, y: Number((e.target as HTMLInputElement).value) } })}
							class="h-7 w-full border-none bg-transparent text-xs outline-none"
							style="color: var(--color-text-primary);"
						/>
					</div>
				</div>
			</div>

			<!-- Size -->
			<div>
				<label class="mb-1 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">
					Size
				</label>
				<div class="grid grid-cols-2 gap-2">
					<div class="flex items-center gap-1.5 rounded-md border px-2"
						style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary);">
						<span class="text-[10px] font-medium" style="color: var(--color-text-muted);">W</span>
						<input
							type="number"
							value={selectedNode.size.width}
							onfocus={captureHistory}
							oninput={(e) => updateNode(selectedNode!.id, { size: { ...selectedNode!.size, width: Number((e.target as HTMLInputElement).value) } })}
							class="h-7 w-full border-none bg-transparent text-xs outline-none"
							style="color: var(--color-text-primary);"
						/>
					</div>
					<div class="flex items-center gap-1.5 rounded-md border px-2"
						style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary);">
						<span class="text-[10px] font-medium" style="color: var(--color-text-muted);">H</span>
						<input
							type="number"
							value={selectedNode.size.height}
							onfocus={captureHistory}
							oninput={(e) => updateNode(selectedNode!.id, { size: { ...selectedNode!.size, height: Number((e.target as HTMLInputElement).value) } })}
							class="h-7 w-full border-none bg-transparent text-xs outline-none"
							style="color: var(--color-text-primary);"
						/>
					</div>
				</div>
			</div>

			<!-- Style -->
			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<label class="mb-2 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">
					Style
				</label>
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Background</span>
						<div class="flex items-center gap-1.5">
							<input
								type="color"
								value={selectedNode.style?.backgroundColor || '#ffffff'}
								oninput={(e) => updateNodeStyle('backgroundColor', (e.target as HTMLInputElement).value)}
								class="h-6 w-6 cursor-pointer rounded border"
								style="border-color: var(--color-border-primary);"
							/>
							{#if selectedNode.style?.backgroundColor}
								<button
									onclick={() => updateNodeStyle('backgroundColor', '')}
									class="text-[10px]"
									style="color: var(--color-text-muted);"
								>Reset</button>
							{/if}
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Border</span>
						<div class="flex items-center gap-1.5">
							<input
								type="color"
								value={selectedNode.style?.borderColor || '#e5e7eb'}
								oninput={(e) => updateNodeStyle('borderColor', (e.target as HTMLInputElement).value)}
								class="h-6 w-6 cursor-pointer rounded border"
								style="border-color: var(--color-border-primary);"
							/>
							{#if selectedNode.style?.borderColor}
								<button
									onclick={() => updateNodeStyle('borderColor', '')}
									class="text-[10px]"
									style="color: var(--color-text-muted);"
								>Reset</button>
							{/if}
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Font Size</span>
						<select
							value={selectedNode.style?.fontSize || '12'}
							onfocus={captureHistory}
							onchange={(e) => updateNodeStyle('fontSize', (e.target as HTMLSelectElement).value)}
							class="h-6 rounded border px-1.5 text-[11px] outline-none"
							style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
						>
							<option value="10">10px</option>
							<option value="12">12px</option>
							<option value="14">14px</option>
							<option value="16">16px</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Handle Distribution -->
			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<label class="mb-2 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">
					Handle Distribution
				</label>
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Node Default</span>
						<select
							value={(selectedNode.data.handleDistribution as string) || ''}
							onfocus={captureHistory}
							onchange={(e) => {
								const val = (e.target as HTMLSelectElement).value;
								const newData = { ...selectedNode!.data };
								if (val) newData.handleDistribution = val;
								else delete newData.handleDistribution;
								updateNode(selectedNode!.id, { data: newData });
							}}
							class="h-6 rounded border px-1.5 text-[11px] outline-none"
							style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
						>
							<option value="">Default</option>
							<option value="center">Center</option>
							<option value="distributed">Distributed</option>
						</select>
					</div>
					{#each (['top', 'bottom', 'left', 'right'] as const) as side}
						{#if selectedNode.ports[side]}
							<div class="flex items-center justify-between">
								<span class="text-[11px] capitalize" style="color: var(--color-text-muted);">{side}</span>
								<select
									value={selectedNode.ports[`${side}Distribution`] || ''}
									onfocus={captureHistory}
									onchange={(e) => {
										const val = (e.target as HTMLSelectElement).value;
										const ports = { ...selectedNode!.ports };
										if (val) {
											(ports as Record<string, unknown>)[`${side}Distribution`] = val;
										} else {
											delete (ports as Record<string, unknown>)[`${side}Distribution`];
										}
										updateNode(selectedNode!.id, { ports });
									}}
									class="h-6 rounded border px-1.5 text-[11px] outline-none"
									style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
								>
									<option value="">Inherit</option>
									<option value="center">Center</option>
									<option value="distributed">Distributed</option>
								</select>
							</div>
						{/if}
					{/each}
				</div>
			</div>

		<!-- Node info (read-only) -->
			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<div class="flex items-center justify-between text-[10px]" style="color: var(--color-text-muted);">
					<span>Type</span>
					<span style="color: var(--color-text-tertiary);">{selectedNode.type}</span>
				</div>
				<div class="mt-1.5 flex items-center justify-between text-[10px]" style="color: var(--color-text-muted);">
					<span>ID</span>
					<span class="max-w-[150px] truncate font-mono" style="color: var(--color-text-tertiary);">{selectedNode.id}</span>
				</div>
			</div>

			<!-- Delete -->
			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<button
					onclick={handleDeleteNode}
					class="flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors"
					style="color: var(--color-error-text); border-color: var(--color-border-primary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-error-bg)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<Trash2 size={12} />
					Delete Node
				</button>
			</div>
		</div>
	{:else if selectedEdge}
		<!-- Edge properties -->
		<div class="border-b px-3 py-2.5" style="border-color: var(--color-border-subtle);">
			<span class="text-sm font-medium" style="color: var(--color-text-primary);">Edge</span>
			<span class="ml-2 text-[10px]" style="color: var(--color-text-muted);">Connection</span>
		</div>

		<div class="flex-1 space-y-4 overflow-y-auto p-3">
			<div>
				<label class="mb-1 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">Label</label>
				<input
					value={selectedEdge.label}
					onfocus={captureHistory}
					oninput={(e) => updateEdge(selectedEdge!.id, { label: (e.target as HTMLInputElement).value })}
					class="h-8 w-full rounded-md border px-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
					style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
					placeholder="e.g. Yes, No, Next..."
				/>
			</div>

			<div>
				<label class="mb-1 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">Description</label>
				<textarea
					value={selectedEdge.description}
					onfocus={captureHistory}
					oninput={(e) => updateEdge(selectedEdge!.id, { description: (e.target as HTMLTextAreaElement).value })}
					rows="2"
					class="w-full resize-none rounded-md border px-2.5 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
					style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
				></textarea>
			</div>

			<div>
				<label class="flex items-center gap-2 text-[11px] font-medium" style="color: var(--color-text-tertiary);">
					<input
						type="checkbox"
						checked={selectedEdge.animated}
						onchange={(e) => { captureHistory(); updateEdge(selectedEdge!.id, { animated: (e.target as HTMLInputElement).checked }); }}
						class="rounded"
					/>
					Animated flow
				</label>
			</div>

			<div>
				<label class="mb-1 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">Edge Type</label>
				<select
					value={selectedEdge.type}
					onfocus={captureHistory}
					onchange={(e) => updateEdge(selectedEdge!.id, { type: (e.target as HTMLSelectElement).value })}
					class="h-8 w-full rounded-md border px-2 text-xs outline-none"
					style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
				>
					<option value="smoothstep">Smooth Step</option>
					<option value="bezier">Bezier</option>
					<option value="straight">Straight</option>
					<option value="step">Step</option>
				</select>
			</div>

			<!-- Markers -->
			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<label class="mb-2 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">Markers</label>
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Start</span>
						<select
							value={selectedEdge.markerStart || 'none'}
							onfocus={captureHistory}
								onchange={(e) => updateEdge(selectedEdge!.id, { markerStart: (e.target as HTMLSelectElement).value as MarkerType })}
							class="h-6 rounded border px-1.5 text-[11px] outline-none"
							style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
						>
							{#each markerOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">End</span>
						<select
							value={selectedEdge.markerEnd || 'arrowclosed'}
							onfocus={captureHistory}
								onchange={(e) => updateEdge(selectedEdge!.id, { markerEnd: (e.target as HTMLSelectElement).value as MarkerType })}
							class="h-6 rounded border px-1.5 text-[11px] outline-none"
							style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
						>
							{#each markerOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			<!-- Stroke Style -->
			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<label class="mb-2 block text-[11px] font-medium" style="color: var(--color-text-tertiary);">Stroke</label>
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Style</span>
						<select
							value={selectedEdge.strokeStyle || 'solid'}
							onfocus={captureHistory}
								onchange={(e) => updateEdge(selectedEdge!.id, { strokeStyle: (e.target as HTMLSelectElement).value as StrokeStyle })}
							class="h-6 rounded border px-1.5 text-[11px] outline-none"
							style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
						>
							{#each strokeStyleOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Width</span>
						<input
							type="number"
							min="0.5"
							max="5"
							step="0.5"
							value={selectedEdge.strokeWidth ?? 1.5}
							onfocus={captureHistory}
								oninput={(e) => updateEdge(selectedEdge!.id, { strokeWidth: Number((e.target as HTMLInputElement).value) })}
							class="h-6 w-16 rounded border px-1.5 text-[11px] outline-none"
							style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
						/>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-[11px]" style="color: var(--color-text-muted);">Color</span>
						<div class="flex items-center gap-1.5">
							<input
								type="color"
								value={selectedEdge.strokeColor || '#94a3b8'}
								onfocus={captureHistory}
								oninput={(e) => updateEdge(selectedEdge!.id, { strokeColor: (e.target as HTMLInputElement).value })}
								class="h-6 w-6 cursor-pointer rounded border"
								style="border-color: var(--color-border-primary);"
							/>
							{#if selectedEdge.strokeColor}
								<button
									onclick={() => { captureHistory(); updateEdge(selectedEdge!.id, { strokeColor: undefined }); }}
									class="text-[10px]"
									style="color: var(--color-text-muted);"
								>Reset</button>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<div class="flex items-center justify-between text-[10px]" style="color: var(--color-text-muted);">
					<span>Source</span>
					<span class="max-w-[120px] truncate font-mono" style="color: var(--color-text-tertiary);">{selectedEdge.source}</span>
				</div>
				<div class="mt-1.5 flex items-center justify-between text-[10px]" style="color: var(--color-text-muted);">
					<span>Target</span>
					<span class="max-w-[120px] truncate font-mono" style="color: var(--color-text-tertiary);">{selectedEdge.target}</span>
				</div>
				<div class="mt-1.5 flex items-center justify-between text-[10px]" style="color: var(--color-text-muted);">
					<span>ID</span>
					<span class="max-w-[150px] truncate font-mono" style="color: var(--color-text-tertiary);">{selectedEdge.id}</span>
				</div>
			</div>

			<!-- Delete Edge -->
			<div class="border-t pt-3" style="border-color: var(--color-border-subtle);">
				<button
					onclick={handleDeleteEdge}
					class="flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors"
					style="color: var(--color-error-text); border-color: var(--color-border-primary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-error-bg)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<Trash2 size={12} />
					Delete Edge
				</button>
			</div>
		</div>
	{:else if multiSelected}
		<div class="flex flex-col items-center justify-center p-6 text-center" style="flex: 1;">
			<p class="text-sm font-medium" style="color: var(--color-text-secondary);">
				{$selectedNodeIds.size} nodes selected
			</p>
			<p class="mt-1 text-[11px]" style="color: var(--color-text-muted);">
				Select a single node to edit properties
			</p>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center p-6 text-center" style="flex: 1;">
			<p class="text-xs" style="color: var(--color-text-muted);">
				Click a node or edge to inspect its properties
			</p>
		</div>
	{/if}
	</div>
{/if}
