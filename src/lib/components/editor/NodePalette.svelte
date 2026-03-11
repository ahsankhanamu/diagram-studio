<script lang="ts">
	import { NODE_CATEGORIES, type NodeCategory } from '$lib/constants';
	import { getNodesByCategory } from '$lib/components/nodes';
	import { Search, ChevronDown, ChevronRight } from 'lucide-svelte';

	let searchQuery = $state('');
	let expandedCategories = $state<Set<string>>(new Set(['flowchart', 'architecture', 'erd', 'workflow']));

	const categoryLabels: Record<NodeCategory, string> = {
		shapes: 'Shapes',
		flowchart: 'Flowchart',
		architecture: 'Architecture',
		erd: 'ERD',
		workflow: 'Workflow'
	};

	const categoryColors: Record<NodeCategory, string> = {
		shapes: 'var(--color-accent)',
		flowchart: 'var(--color-node-flowchart)',
		architecture: 'var(--color-node-architecture)',
		erd: 'var(--color-node-erd)',
		workflow: 'var(--color-node-workflow)'
	};

	const nodeTypeColors: Record<string, string> = {
		'shape-rect': 'var(--color-accent)',
		'shape-circle': 'var(--color-accent)',
		'shape-diamond': 'var(--color-accent)',
		'text': 'var(--color-accent)',
		'process': 'var(--color-node-process)',
		'decision': 'var(--color-node-decision)',
		'terminal': 'var(--color-node-terminal)',
		'io': 'var(--color-node-io)',
		'document': 'var(--color-node-document)',
		'service': 'var(--color-node-service)',
		'database': 'var(--color-node-database)',
		'queue': 'var(--color-node-queue)',
		'api': 'var(--color-node-api)',
		'user': 'var(--color-node-user)',
		'entity': 'var(--color-node-erd)',
		'group': 'var(--color-accent)',
		'workflow': 'var(--color-node-workflow)',
	};

	const iconPaths: Record<string, string> = {
		Square: 'M3 3h18v18H3z',
		Diamond: 'M12 2l10 10-10 10L2 12z',
		Circle: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0',
		ArrowLeftRight: 'M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4',
		FileText: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8',
		Server: 'M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01',
		Database: 'M12 5c5 0 9 1.3 9 3s-4 3-9 3-9-1.3-9-3 4-3 9-3zM3 12c0 1.7 4 3 9 3s9-1.3 9-3M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5',
		ListOrdered: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
		Globe: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
		User: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 7a4 4 0 100 8 4 4 0 000-8z',
		Table: 'M3 3h18v18H3zM3 9h18M3 15h18M12 3v18',
		Workflow: 'M3 3h8v8H3zM13 13h8v8H13zM7 11v2a2 2 0 002 2h2M17 7h-2a2 2 0 00-2 2v2'
	};

	function getFilteredCategories() {
		const q = searchQuery.toLowerCase().trim();
		return NODE_CATEGORIES.filter((c) => c !== 'shapes').map((cat) => {
			const nodes = getNodesByCategory(cat);
			const filtered = q
				? nodes.filter(
						(n) => n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
					)
				: nodes;
			return { category: cat, nodes: filtered };
		}).filter((c) => c.nodes.length > 0);
	}

	const filteredCategories = $derived(getFilteredCategories());

	function toggleCategory(cat: string) {
		expandedCategories = new Set(expandedCategories);
		if (expandedCategories.has(cat)) {
			expandedCategories.delete(cat);
		} else {
			expandedCategories.add(cat);
		}
	}

	function handleDragStart(event: DragEvent, type: string) {
		if (event.dataTransfer) {
			event.dataTransfer.setData('application/diagram-node-type', type);
			event.dataTransfer.effectAllowed = 'move';
		}
	}
</script>

<div class="flex flex-col overflow-hidden" style="flex: 1;">
	<!-- Search -->
	<div class="border-b p-2" style="border-color: var(--color-border-subtle);">
		<div class="relative">
			<Search
				size={13}
				class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
				style="color: var(--color-text-muted);"
			/>
			<input
				type="text"
				placeholder="Search nodes..."
				bind:value={searchQuery}
				class="h-7 w-full rounded-md border pl-8 pr-2 text-xs outline-none transition-colors"
				style="background: var(--color-bg-surface-secondary); border-color: var(--color-border-primary); color: var(--color-text-primary);"
			/>
		</div>
	</div>

	<!-- Category groups -->
	<div class="flex-1 space-y-3 overflow-y-auto p-2">
		{#each filteredCategories as { category, nodes }}
			<div>
				<!-- Category header -->
				<button
					onclick={() => toggleCategory(category)}
					class="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<span class="inline-block h-2 w-2 rounded-full" style="background: {categoryColors[category]};"></span>
					<span class="flex-1 text-left">{categoryLabels[category]}</span>
					<span class="transition-transform duration-200" style="transform: rotate({expandedCategories.has(category) ? '0deg' : '-90deg'});">
						<ChevronDown size={12} />
					</span>
				</button>

				<div
					class="grid transition-[grid-template-rows] duration-200 ease-out"
					style="grid-template-rows: {expandedCategories.has(category) || searchQuery ? '1fr' : '0fr'};"
				>
					<div class="overflow-hidden">
						<div class="space-y-0.5">
							{#each nodes as nodeDef}
								<div
									draggable="true"
									ondragstart={(e) => handleDragStart(e, nodeDef.type)}
									class="group flex cursor-grab items-start gap-2 rounded-md px-2 py-1.5 transition-colors active:cursor-grabbing"
									style="color: var(--color-text-secondary);"
									onmouseenter={(e) => {
										(e.currentTarget as HTMLElement).style.backgroundColor =
											'var(--color-hover-overlay)';
									}}
									onmouseleave={(e) => {
										(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
									}}
									title={nodeDef.description}
									role="button"
									tabindex="0"
								>
									<!-- Icon badge: tinted background -->
									<div
										class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded"
										style="background-color: color-mix(in srgb, {nodeTypeColors[nodeDef.type] || categoryColors[category]} 25%, transparent); color: {nodeTypeColors[nodeDef.type] || categoryColors[category]};"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											{#each (iconPaths[nodeDef.icon] || '').split('M').filter(Boolean) as segment}
												<path d="M{segment}" />
											{/each}
										</svg>
									</div>
									<div class="min-w-0 flex-1">
										<span class="block truncate text-xs">{nodeDef.label}</span>
										<span
											class="block text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
											style="color: var(--color-text-muted);"
										>
											{nodeDef.description}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
