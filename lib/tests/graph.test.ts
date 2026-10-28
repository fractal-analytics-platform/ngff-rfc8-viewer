import { describe, it, expect } from 'vitest';
import { NGFFGraph } from '../src/graph';

describe('NGFFGraph', () => {
  describe('resolvePath', () => {
    it('both relative, parent is root', () => {
      const graph = new NGFFGraph({} as any, 0);
      const path = graph.resolvePath('./', './plate/well-A1/well.json');
      expect(path).toEqual('./plate/well-A1/well.json');
    });

    it('both relative, parent is not root', () => {
      const graph = new NGFFGraph({} as any, 0);
      const path = graph.resolvePath('./plate/well-A1', './1_corrected');
      expect(path).toEqual('./plate/well-A1/1_corrected');
    });

    it('child is URL', () => {
      const graph = new NGFFGraph({} as any, 0);
      const path = graph.resolvePath('./', 'https://example.com/graph/zarr.json');
      expect(path).toEqual('https://example.com/graph/zarr.json');
    });

    it('parent is URL without final /', () => {
      const graph = new NGFFGraph({} as any, 0);
      const path = graph.resolvePath('https://example.com/graph', './zarr.json');
      expect(path).toEqual('https://example.com/graph/zarr.json');
    });

    it('parent is URL with final /', () => {
      const graph = new NGFFGraph({} as any, 0);
      const path = graph.resolvePath('https://example.com/graph/', './zarr.json');
      expect(path).toEqual('https://example.com/graph/zarr.json');
    });

    it('.. is not supported', () => {
      const graph = new NGFFGraph({} as any, 0);
      expect(() => graph.resolvePath('https://example.com/graph', '../zarr.json')).toThrow(
        'Unsupported path "../zarr.json"'
      );
    });

    it('protocol not supported', () => {
      const graph = new NGFFGraph({} as any, 0);
      expect(() =>
        graph.resolvePath('https://example.com/graph', 'ftp://example.com/graph/zarr.json')
      ).toThrow('Unsupported path "ftp://example.com/graph/zarr.json"');
    });

    it('absolute path not supported', () => {
      const graph = new NGFFGraph({} as any, 0);
      expect(() => graph.resolvePath('https://example.com/graph', '/zarr.json')).toThrow(
        'Unsupported path "/zarr.json"'
      );
    });
  });
});
