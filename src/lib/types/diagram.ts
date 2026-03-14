export interface DiagramFile {
	$schema: 'diagram-studio/diagram-v1';
	id: string;
	name: string;
	description: string;
	diagramType: string;
	version: number;
	createdAt: string;
	modifiedAt: string;
	viewport: Viewport;
	nodes: DiagramNode[];
	edges: DiagramEdge[];
	metadata: DiagramMetadata;
}

export interface DiagramNode {
	id: string;
	type: string;
	label: string;
	description: string;
	position: Position;
	size: Size;
	data: Record<string, unknown>;
	style: Record<string, string>;
	ports: PortConfig;
	parentId?: string;
	extent?: 'parent';
}

export type MarkerType = 'arrow' | 'arrowclosed' | 'circle' | 'diamond' | 'none';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface DiagramEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle: string;
	targetHandle: string;
	type: string;
	label: string;
	description: string;
	animated: boolean;
	style: Record<string, string>;
	markerStart?: MarkerType;
	markerEnd?: MarkerType;
	strokeStyle?: StrokeStyle;
	strokeWidth?: number;
	strokeColor?: string;
	centerX?: number;
	centerY?: number;
}

export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface Viewport {
	x: number;
	y: number;
	zoom: number;
}

export interface PortConfig {
	top: boolean;
	bottom: boolean;
	left: boolean;
	right: boolean;
}

export interface DiagramMetadata {
	tags: string[];
	author: string;
	notes: string;
}
