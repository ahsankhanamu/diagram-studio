/**
 * API endpoint to read a diagram JSON file from disk.
 *
 * GET /api/diagram?path=/absolute/path/to/diagram.json
 *
 * Used by the /preview route and Playwright screenshot automation.
 * Only available in dev mode — production uses File System Access API.
 */

import { json, error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const filePath = url.searchParams.get('path');

	if (!filePath) {
		throw error(400, 'Missing ?path= query parameter');
	}

	if (!filePath.endsWith('.json')) {
		throw error(400, 'Path must point to a .json file');
	}

	if (!existsSync(filePath)) {
		throw error(404, `File not found: ${filePath}`);
	}

	try {
		const content = await readFile(filePath, 'utf-8');
		const diagram = JSON.parse(content);

		// Basic validation
		if (diagram.$schema !== 'diagram-studio/diagram-v1') {
			throw error(400, 'Not a valid diagram-studio file');
		}

		return json(diagram);
	} catch (err: any) {
		if (err.status) throw err; // re-throw SvelteKit errors
		throw error(500, `Failed to read diagram: ${err.message}`);
	}
};
