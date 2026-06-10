import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function src(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

function importLines(source: string): string[] {
  return source
    .split('\n')
    .filter(line => line.trimStart().startsWith('import'));
}

function runtimeImportLines(source: string): string[] {
  return importLines(source).filter(
    line => !line.trimStart().startsWith('import type')
  );
}

const PURE_FILES = [
  'src/types/simulation.ts',
  'src/math/validation.ts',
  'src/io/serializer.ts',
  'src/math/networkSolver.ts',
  'src/math/sweepEngine.ts',
  'src/math/targetSolver.ts',
  'src/math/comparisonEngine.ts',
  'src/schema/parameterSchema.ts',
  'src/math/pressureDropModel.ts',
  'src/math/gasPhaseFactor.ts',
] as const;

describe('purity invariants — zero store/React runtime imports', () => {
  for (const relPath of PURE_FILES) {
    describe(relPath, () => {
      it('has no import from the Zustand store', () => {
        const lines = importLines(src(relPath)).join('\n');
        expect(lines).not.toMatch(/\/store['"\/]/);
        expect(lines).not.toContain('zustand');
      });

      it('has no runtime import from react', () => {
        const lines = runtimeImportLines(src(relPath)).join('\n');
        expect(lines).not.toMatch(/from\s+['"]react['"]/);
      });
    });
  }
});
