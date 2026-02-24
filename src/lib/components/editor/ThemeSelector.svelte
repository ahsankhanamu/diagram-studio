<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Moon, Sparkles, Check, ChevronDown } from 'lucide-svelte';
	import { theme, setTheme, type Theme } from '$lib/stores/themeStore';

	let isOpen = $state(false);
	let dropdownRef: HTMLDivElement | undefined = $state();

	const themes: { id: Theme; name: string; preview: string }[] = [
		{ id: 'light', name: 'Light', preview: '#f5f6fa' },
		{ id: 'dark', name: 'Dark', preview: '#121218' },
		{ id: 'midnight', name: 'Midnight', preview: '#0a1628' }
	];

	const themeIcons = { light: Sun, dark: Moon, midnight: Sparkles } as const;

	function toggleLightDark() {
		if ($theme === 'light') setTheme('dark');
		else if ($theme === 'dark') setTheme('light');
		else setTheme('light');
	}

	function selectTheme(id: Theme) {
		setTheme(id);
		isOpen = false;
	}

	function toggleDropdown(e: MouseEvent) {
		e.stopPropagation();
		isOpen = !isOpen;
	}

	onMount(() => {
		function handleClick(e: MouseEvent) {
			if (dropdownRef && !dropdownRef.contains(e.target as Node)) isOpen = false;
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === 'Escape') isOpen = false;
		}
		document.addEventListener('click', handleClick);
		document.addEventListener('keydown', handleKey);
		return () => {
			document.removeEventListener('click', handleClick);
			document.removeEventListener('keydown', handleKey);
		};
	});
</script>

<div class="relative flex items-center" bind:this={dropdownRef}>
	<!-- Split button container -->
	<div
		class="flex items-center overflow-hidden rounded-lg"
		style="border: 1px solid var(--color-border-primary);"
	>
		<!-- Light/Dark toggle (left) -->
		<button
			onclick={toggleLightDark}
			class="flex items-center gap-1.5 px-2 py-1.5 transition-colors"
			style="background: var(--color-bg-surface); color: var(--color-text-secondary);"
			title="Toggle light/dark"
			onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
			onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
		>
			{#if $theme === 'light'}
				<Sun size={16} />
			{:else if $theme === 'dark'}
				<Moon size={16} />
			{:else}
				<Sparkles size={16} />
			{/if}
		</button>

		<!-- Divider -->
		<div class="h-5 w-px" style="background: var(--color-border-primary);"></div>

		<!-- Dropdown trigger (right) -->
		<button
			onclick={toggleDropdown}
			class="flex items-center px-1.5 py-1.5 transition-colors"
			style="background: var(--color-bg-surface); color: var(--color-text-muted);"
			title="More themes"
			onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
			onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
		>
			<ChevronDown
				size={14}
				style="transform: rotate({isOpen ? '180deg' : '0deg'}); transition: transform 0.15s;"
			/>
		</button>
	</div>

	<!-- Dropdown menu -->
	{#if isOpen}
		<div
			class="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg py-1 shadow-lg"
			style="background: var(--color-bg-surface); border: 1px solid var(--color-border-primary);"
		>
			<div class="px-3 py-1.5 text-[10px] font-medium" style="color: var(--color-text-muted);">
				Select Theme
			</div>

			{#each themes as t}
				{@const Icon = themeIcons[t.id]}
				<button
					onclick={() => selectTheme(t.id)}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
					style="color: var(--color-text-primary); {$theme === t.id ? 'background: var(--color-bg-surface-secondary);' : ''}"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = $theme === t.id ? 'var(--color-bg-surface-secondary)' : 'transparent')}
				>
					<div
						class="flex h-5 w-5 items-center justify-center rounded-md border"
						style="background: {t.preview}; border-color: var(--color-border-secondary);"
					>
						<Icon size={12} style="color: {t.id === 'light' ? '#1f2937' : '#f0f0f5'};" />
					</div>
					<span class="flex-1">{t.name}</span>
					{#if $theme === t.id}
						<Check size={14} style="color: var(--color-accent);" />
					{/if}
				</button>
			{/each}

			<div class="mx-2 my-1 border-t" style="border-color: var(--color-border-primary);"></div>
			<div class="px-3 py-1 text-[10px]" style="color: var(--color-text-muted);">
				Click icon to toggle light/dark
			</div>
		</div>
	{/if}
</div>
