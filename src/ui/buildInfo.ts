import { aboutDemoText as text } from '../data/ui/aboutDemoSchema';

export interface BuildInfo {
  version: string;
  build: string;
  seed?: string | null;
  scene?: string | null;
}

export const appBuild = {
  version: typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__,
  build: typeof __APP_BUILD__ === 'undefined' ? 'dev' : __APP_BUILD__,
};

export function buildInfoText(info: BuildInfo): string {
  const parts = [`v${info.version}`, info.build];
  if (info.seed) parts.push(`${text.labels.seed}: ${info.seed}`);
  if (info.scene) parts.push(`${text.labels.scene}: ${info.scene}`);
  return parts.join(' · ');
}

export function bugReportText(
  info: BuildInfo & {
    userAgent: string;
    resolution: { width: number; height: number };
    date: string;
  },
): string {
  return [
    `${text.labels.version}: ${info.version}`,
    `${text.labels.build}: ${info.build}`,
    `${text.labels.seed}: ${info.seed || text.missing}`,
    `${text.labels.scene}: ${info.scene || text.missing}`,
    `${text.labels.userAgent}: ${info.userAgent}`,
    `${text.labels.resolution}: ${info.resolution.width} × ${info.resolution.height}`,
    `${text.labels.date}: ${info.date}`,
  ].join('\n');
}
