import type { NodeCategory } from '$lib/constants';

export interface NodeTypeDefinition {
	type: string;
	label: string;
	category: NodeCategory;
	icon: string;
	color: string;
	description: string;
	defaultSize: { width: number; height: number };
	defaultPorts: { top: boolean; bottom: boolean; left: boolean; right: boolean };
	defaultData: Record<string, unknown>;
}
