<script lang="ts">
	import { updateNode } from '$lib/stores/diagramStore';
	import { editingNodeId } from '$lib/stores/editStore';

	interface Props {
		id: string;
		label: string;
		class?: string;
		style?: string;
	}

	const { id, label, class: className = '', style: styleStr = '' }: Props = $props();

	let editing = $state(false);
	let editEl: HTMLSpanElement | undefined = $state();

	// React to Enter-to-rename from the editor (like macOS Finder)
	$effect(() => {
		if ($editingNodeId === id && !editing) {
			editing = true;
			enterEditMode();
			// Clear the signal so it doesn't re-trigger
			editingNodeId.set(null);
		}
	});

	function enterEditMode() {
		requestAnimationFrame(() => {
			if (!editEl) return;
			editEl.focus();
			// Select all text like macOS rename
			const range = document.createRange();
			range.selectNodeContents(editEl);
			const sel = window.getSelection();
			sel?.removeAllRanges();
			sel?.addRange(range);
		});
	}

	function startEdit(e: MouseEvent) {
		e.stopPropagation();
		editing = true;
		enterEditMode();
	}

	function commitEdit() {
		if (!editing) return;
		editing = false;
		const newLabel = editEl?.textContent?.trim() || '';
		if (newLabel && newLabel !== label) {
			updateNode(id, { label: newLabel });
		} else if (editEl) {
			editEl.textContent = label;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			editEl?.blur();
		}
		if (e.key === 'Escape') {
			if (editEl) editEl.textContent = label;
			editing = false;
			editEl?.blur();
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			editEl?.blur();
		}
		// Prevent node deletion/movement shortcuts while editing
		e.stopPropagation();
	}

	function handleMousedown(e: MouseEvent) {
		if (editing) {
			e.stopPropagation();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if editing}
	<span
		bind:this={editEl}
		class="editable-label editing {className}"
		style={styleStr}
		contenteditable="true"
		ondblclick={(e) => e.stopPropagation()}
		onblur={commitEdit}
		onkeydown={handleKeydown}
		onmousedown={handleMousedown}
		role="textbox"
		tabindex={0}
	>{label}</span>
{:else}
	<span
		bind:this={editEl}
		class="editable-label {className}"
		style={styleStr}
		ondblclick={startEdit}
		role="textbox"
		tabindex={-1}
	>{label}</span>
{/if}

<style>
	.editable-label {
		cursor: default;
		outline: none;
		min-width: 1ch;
		border-radius: 4px;
		transition: background 0.15s ease, box-shadow 0.15s ease;
	}

	/* macOS-style text field when editing */
	.editable-label.editing {
		cursor: text;
		background: var(--color-bg-surface);
		padding: 1px 6px;
		margin: -1px -6px;
		border-radius: 5px;
		box-shadow:
			0 0 0 1.5px color-mix(in srgb, var(--color-accent) 60%, transparent),
			0 0 0 3.5px color-mix(in srgb, var(--color-accent) 18%, transparent),
			0 1px 3px rgba(0, 0, 0, 0.08);
		outline: none;
		white-space: pre-wrap;
		word-break: break-word;
		z-index: 10;
		position: relative;
	}
</style>
