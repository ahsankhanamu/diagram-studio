import type { Component } from 'svelte';
import SmartEdge from './SmartEdge.svelte';

export const edgeTypes: Record<string, Component<any>> = {
	smoothstep: SmartEdge,
	bezier: SmartEdge,
	straight: SmartEdge,
	step: SmartEdge,
	labeled: SmartEdge,
	animated: SmartEdge
};
