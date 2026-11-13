export interface DebugHandle {
  tick(): number;
  sceneId(): string;
  query(name: string): unknown;
  command(line: string): string;
}

declare global {
  interface Window {
    __neoryder?: DebugHandle;
  }
}
