<script lang="ts">
	import CodeMirror from 'svelte-codemirror-editor';
	import { json } from '@codemirror/lang-json';
	import { linter, lintGutter } from '@codemirror/lint';
	import { X } from 'lucide-svelte';

	interface Props {
		value: string;
		onSave?: (value: string) => void;
		onClose?: () => void;
		fileName?: string;
	}

	let { value, onSave, onClose, fileName = '' }: Props = $props();

	let editorValue = $state(value);
	let parseError = $state<string | null>(null);
	let isDirty = $state(false);

	const jsonLinter = linter((view) => {
		const diagnostics: any[] = [];
		const text = view.state.doc.toString();
		if (!text.trim()) return diagnostics;
		try {
			JSON.parse(text);
			parseError = null;
		} catch (e: any) {
			const match = e.message.match(/position (\d+)/);
			const pos = match ? Number(match[1]) : 0;
			diagnostics.push({
				from: Math.min(pos, text.length),
				to: Math.min(pos + 1, text.length),
				severity: 'error',
				message: e.message
			});
			parseError = e.message;
		}
		return diagnostics;
	});

	const extensions = [json(), jsonLinter, lintGutter()];

	function handleChange(newValue: string) {
		editorValue = newValue;
		isDirty = newValue !== value;
	}

	function handleSave() {
		if (!isDirty || parseError) return;
		try {
			JSON.parse(editorValue);
			onSave?.(editorValue);
			isDirty = false;
		} catch {
			// Don't save invalid JSON
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col" style="background: var(--color-bg-surface);">
	<!-- Header -->
	<div
		class="flex items-center justify-between border-b px-3 py-2"
		style="border-color: var(--color-border-primary);"
	>
		<div class="flex items-center gap-2 min-w-0">
			<span class="truncate text-xs font-medium" style="color: var(--color-text-primary);">
				{fileName}
			</span>
			{#if isDirty}
				<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
					style="background: var(--color-warning-bg); color: var(--color-warning-text);">
					Modified
				</span>
			{/if}
			{#if parseError}
				<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
					style="background: var(--color-error-bg); color: var(--color-error-text);">
					Invalid JSON
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-1.5">
			{#if isDirty}
				<button
					onclick={handleSave}
					disabled={!!parseError}
					class="rounded px-2.5 py-1 text-[11px] font-medium text-white transition-colors"
					style="background: {parseError ? 'var(--color-text-muted)' : 'var(--color-accent)'};"
				>
					Save
				</button>
			{/if}
			{#if onClose}
				<button
					onclick={onClose}
					class="flex h-6 w-6 items-center justify-center rounded transition-colors"
					style="color: var(--color-text-muted);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
					title="Close editor"
				>
					<X size={14} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Editor -->
	<div class="relative flex-1">
		<div class="json-editor-wrapper absolute inset-0 overflow-hidden">
			<CodeMirror
				value={editorValue}
				lang={json()}
				extensions={extensions}
				onchange={handleChange}
			/>
		</div>
	</div>
</div>

<style>
	.json-editor-wrapper :global(.codemirror-wrapper) {
		height: 100%;
	}
	.json-editor-wrapper :global(.cm-editor) {
		height: 100%;
	}
	.json-editor-wrapper :global(.cm-scroller) {
		overflow: auto !important;
	}
</style>
