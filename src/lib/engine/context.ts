/**
 * Project context loader.
 * Reads `.diagram-studio/context.md` from the workspace directory if it exists.
 * Returns the raw context string for use in AI prompts or design decision reference.
 */
export async function loadProjectContext(
	directoryHandle: FileSystemDirectoryHandle
): Promise<string | null> {
	try {
		const contextDir = await directoryHandle.getDirectoryHandle('.diagram-studio', {
			create: false
		});
		const fileHandle = await contextDir.getFileHandle('context.md', {
			create: false
		});
		const file = await fileHandle.getFile();
		const text = await file.text();
		return text.trim() || null;
	} catch {
		// Directory or file doesn't exist — that's fine
		return null;
	}
}
