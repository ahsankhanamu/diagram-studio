export interface ShapePreset {
	id: string;
	name: string;
	nodeType: string;
	label: string;
	size: { width: number; height: number };
	data: Record<string, unknown>;
	style: Record<string, string>;
}

export interface ShapeLibrary {
	$schema: 'diagram-studio/shape-library-v1';
	id: string;
	name: string;
	shapes: ShapePreset[];
}
