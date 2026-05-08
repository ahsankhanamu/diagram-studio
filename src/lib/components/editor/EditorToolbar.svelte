<script lang="ts">
	import {
		PanelLeft,
		PanelRight,
		Undo2,
		Redo2,
		Save,
		Download,
		Upload,
		ChevronDown,
		AlignVerticalJustifyStart,
		AlignHorizontalJustifyStart,
		Radio,
		FolderOpen,
		Code,
		Eye,
		Image,
		FileJson,
		FileCode,
		Globe,
		Clipboard,
		TriangleAlert
	} from 'lucide-svelte';
	import { saveStatus } from '$lib/stores/diagramStore';
	import { canUndo, canRedo } from '$lib/stores/historyStore';
	import { leftPanelOpen, rightPanelOpen, toggleLeftPanel, toggleRightPanel } from '$lib/stores/sidebarStore';
	import { lintTotalCount, lintErrorCount, lintPanelOpen, toggleLintPanel } from '$lib/stores/linterStore';
	import { workspaceName, openWorkspace } from '$lib/stores/workspaceStore';
	import ThemeSelector from './ThemeSelector.svelte';

	interface Props {
		diagramName: string;
		diagramType: string;
		syncStatus?: 'connected' | 'disconnected' | 'syncing';
		showJsonEditor?: boolean;
		isVSCode?: boolean;
		onSave?: () => void;
		onImport?: () => void;
		onExportJson?: () => void;
		onExportPng?: () => void;
		onExportHtml?: () => void;
		onExportAllHtml?: () => void;
		onCopyImage?: () => void;
		onAutoLayout?: (direction: 'TB' | 'LR') => void;
		onUndo?: () => void;
		onRedo?: () => void;
		onWorkspaceChanged?: () => void;
		onToggleJsonEditor?: () => void;
	}

	const {
		diagramName,
		diagramType,
		syncStatus = 'disconnected',
		showJsonEditor = false,
		isVSCode = false,
		onSave,
		onImport,
		onExportJson,
		onExportPng,
		onExportHtml,
		onExportAllHtml,
		onCopyImage,
		onAutoLayout,
		onUndo,
		onRedo,
		onWorkspaceChanged,
		onToggleJsonEditor
	}: Props = $props();

	const syncColors: Record<string, string> = {
		connected: 'var(--color-status-saved)',
		disconnected: 'var(--color-text-muted)',
		syncing: 'var(--color-status-saving)'
	};

	const syncLabels: Record<string, string> = {
		connected: 'Live',
		disconnected: 'Offline',
		syncing: 'Syncing...'
	};

	let showLayoutDropdown = $state(false);
	let showExportDropdown = $state(false);

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (showLayoutDropdown && !target.closest('[data-layout-dropdown]')) {
			showLayoutDropdown = false;
		}
		if (showExportDropdown && !target.closest('[data-export-dropdown]')) {
			showExportDropdown = false;
		}
	}

	const statusColors: Record<string, string> = {
		saved: 'var(--color-status-saved)',
		saving: 'var(--color-status-saving)',
		unsaved: 'var(--color-status-unsaved)'
	};

	const statusLabels: Record<string, string> = {
		saved: 'Saved',
		saving: 'Saving...',
		unsaved: 'Unsaved'
	};

	async function handleSwitchFolder() {
		const opened = await openWorkspace();
		if (opened) onWorkspaceChanged?.();
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div
	class="flex h-12 shrink-0 items-center gap-2 border-b px-3"
	style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
>
	<!-- Sidebar toggle -->
	<button
		onclick={toggleLeftPanel}
		class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
		style="color: var(--color-text-tertiary); {$leftPanelOpen
			? 'background: var(--color-hover-overlay);'
			: ''}"
		title="Toggle sidebar"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => { if (!$leftPanelOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
	>
		<PanelLeft size={18} />
	</button>

	<div class="h-6 w-px" style="background: var(--color-border-primary);"></div>

	<!-- Folder switcher -->
	<button
		onclick={handleSwitchFolder}
		class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors"
		style="color: var(--color-text-muted);"
		title="Switch folder ({$workspaceName})"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<FolderOpen size={16} />
		<span class="max-w-[140px] truncate text-xs">{$workspaceName}</span>
	</button>

	<div class="h-6 w-px" style="background: var(--color-border-primary);"></div>

	<!-- Diagram name + save status -->
	<span
		class="max-w-[200px] truncate text-sm font-medium"
		style="color: var(--color-text-primary);"
	>
		{diagramName}
	</span>

	<div class="flex items-center gap-1.5">
		<div class="h-2 w-2 rounded-full" style="background: {statusColors[$saveStatus]};"></div>
		<span class="text-xs" style="color: var(--color-text-muted);">
			{statusLabels[$saveStatus]}
		</span>
	</div>

	<!-- Sync status -->
	<div class="flex items-center gap-1.5" title="File sync: {syncLabels[syncStatus]}">
		<Radio size={12} style="color: {syncColors[syncStatus]};" />
		<span class="text-xs" style="color: {syncColors[syncStatus]};">
			{syncLabels[syncStatus]}
		</span>
	</div>

	<div class="h-6 w-px" style="background: var(--color-border-primary);"></div>

	<!-- Undo / Redo -->
	<button
		onclick={onUndo}
		disabled={!$canUndo}
		class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
		style="color: var(--color-text-tertiary);"
		title="Undo (Ctrl+Z)"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Undo2 size={16} />
	</button>
	<button
		onclick={onRedo}
		disabled={!$canRedo}
		class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
		style="color: var(--color-text-tertiary);"
		title="Redo (Ctrl+Shift+Z)"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Redo2 size={16} />
	</button>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Auto Layout -->
	<div class="relative" data-layout-dropdown>
		<div
			class="flex items-center overflow-hidden rounded-lg border"
			style="border-color: var(--color-border-primary);"
		>
			<button
				onclick={() => onAutoLayout?.('TB')}
				class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors"
				style="color: var(--color-text-secondary); background: var(--color-bg-surface);"
				title="Auto layout (top to bottom)"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<AlignVerticalJustifyStart size={14} />
				Layout
			</button>
			<div class="h-5 w-px" style="background: var(--color-border-primary);"></div>
			<button
				onclick={() => (showLayoutDropdown = !showLayoutDropdown)}
				class="flex items-center px-2 py-1.5 transition-colors"
				style="color: var(--color-text-secondary); background: var(--color-bg-surface);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<ChevronDown
					size={14}
					style="transform: rotate({showLayoutDropdown ? '180deg' : '0deg'}); transition: transform 0.15s;"
				/>
			</button>
		</div>

		{#if showLayoutDropdown}
			<div
				class="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border py-1 shadow-lg"
				style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
			>
				<button
					onclick={() => { onAutoLayout?.('TB'); showLayoutDropdown = false; }}
					class="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<AlignVerticalJustifyStart size={14} />
					Top to Bottom
				</button>
				<button
					onclick={() => { onAutoLayout?.('LR'); showLayoutDropdown = false; }}
					class="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<AlignHorizontalJustifyStart size={14} />
					Left to Right
				</button>
			</div>
		{/if}
	</div>

	<button
		onclick={onImport}
		class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
		style="color: var(--color-text-tertiary);"
		title="Import diagram"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Upload size={16} />
	</button>

	<div class="relative" data-export-dropdown>
		<button
			onclick={() => (showExportDropdown = !showExportDropdown)}
			class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
			style="color: var(--color-text-tertiary);"
			title="Export diagram"
			onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
			onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
		>
			<Download size={16} />
		</button>

		{#if showExportDropdown}
			<div
				class="absolute right-0 top-full z-50 mt-1 min-w-[200px] whitespace-nowrap rounded-lg border py-1 shadow-lg"
				style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
			>
				<button
					onclick={() => { onExportPng?.(); showExportDropdown = false; }}
					class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<Image size={14} />
					Export PNG
				</button>
				<button
					onclick={() => { onCopyImage?.(); showExportDropdown = false; }}
					class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<Clipboard size={14} />
					Copy as Image
					<span class="ml-auto text-[10px]" style="color: var(--color-text-muted);">⌘⇧C</span>
				</button>
				<div class="mx-2 my-1 h-px" style="background: var(--color-border-primary);"></div>
				<button
					onclick={() => { onExportHtml?.(); showExportDropdown = false; }}
					class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<FileCode size={14} />
					Export as HTML
				</button>
				<button
					onclick={() => { onExportJson?.(); showExportDropdown = false; }}
					class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<FileJson size={14} />
					Export JSON
				</button>
				{#if !isVSCode}
					<div class="mx-2 my-1 h-px" style="background: var(--color-border-primary);"></div>
					<button
						onclick={() => { onExportAllHtml?.(); showExportDropdown = false; }}
						class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
						style="color: var(--color-text-secondary);"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
					>
						<Globe size={14} />
						Export All as HTML
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- JSON / Visual toggle -->
	<div
		class="flex items-center overflow-hidden rounded-lg border"
		style="border-color: var(--color-border-primary);"
	>
		<button
			onclick={onToggleJsonEditor}
			class="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
			style="color: {showJsonEditor ? 'var(--color-text-secondary)' : 'var(--color-accent)'}; background: {showJsonEditor ? 'transparent' : 'var(--color-accent-light)'};"
			title="Visual editor"
		>
			<Eye size={13} />
			Visual
		</button>
		<div class="h-5 w-px" style="background: var(--color-border-primary);"></div>
		<button
			onclick={onToggleJsonEditor}
			class="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
			style="color: {showJsonEditor ? 'var(--color-accent)' : 'var(--color-text-secondary)'}; background: {showJsonEditor ? 'var(--color-accent-light)' : 'transparent'};"
			title="JSON editor"
		>
			<Code size={13} />
			JSON
		</button>
	</div>

	<button
		onclick={onSave}
		class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
		style="color: var(--color-text-tertiary);"
		title="Save (Ctrl+S)"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Save size={16} />
	</button>

	<!-- Lint toggle -->
	<button
		onclick={toggleLintPanel}
		class="relative flex h-8 items-center gap-1.5 rounded-lg px-2 transition-colors"
		style="color: {$lintErrorCount > 0 ? 'var(--color-error-text)' : $lintTotalCount > 0 ? 'var(--color-status-unsaved)' : 'var(--color-text-tertiary)'}; {$lintPanelOpen ? 'background: var(--color-hover-overlay);' : ''}"
		title="Toggle problems panel ({$lintTotalCount} issue{$lintTotalCount === 1 ? '' : 's'})"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => { if (!$lintPanelOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
	>
		<TriangleAlert size={15} />
		{#if $lintTotalCount > 0}
			<span class="text-[11px] font-medium">{$lintTotalCount}</span>
		{/if}
	</button>

	<div class="h-6 w-px" style="background: var(--color-border-primary);"></div>

	<!-- Theme selector (split dropdown) -->
	<ThemeSelector />

	<button
		onclick={toggleRightPanel}
		class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
		style="color: var(--color-text-tertiary); {$rightPanelOpen
			? 'background: var(--color-hover-overlay);'
			: ''}"
		title="Toggle properties panel"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => { if (!$rightPanelOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
	>
		<PanelRight size={18} />
	</button>
</div>
