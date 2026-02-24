/**
 * Ambient types for the FileSystemObserver API (Chrome 133+).
 * Not yet in lib.dom.d.ts — remove once upstream types ship.
 *
 * @see https://developer.chrome.com/blog/file-system-observer
 */

interface FileSystemObserverRecord {
	readonly changedHandle: FileSystemHandle;
	readonly relativePathComponents: readonly string[];
	readonly type: 'appeared' | 'disappeared' | 'modified' | 'moved' | 'unknown' | 'errored';
	readonly relativePathMovedFrom: readonly string[] | null;
}

type FileSystemObserverCallback = (
	records: FileSystemObserverRecord[],
	observer: FileSystemObserver
) => void;

interface FileSystemObserveOptions {
	recursive?: boolean;
}

declare class FileSystemObserver {
	constructor(callback: FileSystemObserverCallback);
	observe(handle: FileSystemHandle, options?: FileSystemObserveOptions): Promise<void>;
	unobserve(handle: FileSystemHandle): void;
	disconnect(): void;
}
