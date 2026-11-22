import { describe, expect, it } from 'vitest';
import { buildInfoText, bugReportText } from '../../src/ui/buildInfo';

const info = {
  version: '0.9.0',
  build: 'abc1234',
  seed: 'demo-seed',
  scene: 'run',
  userAgent: 'Test Browser',
  resolution: { width: 1280, height: 720 },
  date: '2026-11-22T12:00:00.000Z',
};

describe('informacje dema', () => {
  it('formatuje stopkę i kontekst bieżącej gry', () => {
    expect(buildInfoText({ version: info.version, build: info.build })).toBe(
      'v0.9.0 · abc1234',
    );
    expect(buildInfoText(info)).toBe(
      'v0.9.0 · abc1234 · Seed: demo-seed · Scena: run',
    );
  });
  it('raport zawiera wszystkie dane dostarczone przez wywołującego', () => {
    expect(bugReportText(info)).toBe(
      [
        'Wersja: 0.9.0',
        'Build: abc1234',
        'Seed: demo-seed',
        'Scena: run',
        'Przeglądarka: Test Browser',
        'Rozdzielczość okna: 1280 × 720',
        'Data ISO: 2026-11-22T12:00:00.000Z',
      ].join('\n'),
    );
  });
  it.each([undefined, null, ''])(
    'brak seeda (%s) jest jawny w raporcie',
    (seed) => {
      expect(bugReportText({ ...info, seed })).toContain('Seed: brak');
      expect(buildInfoText({ ...info, seed })).not.toContain('Seed:');
    },
  );
});
