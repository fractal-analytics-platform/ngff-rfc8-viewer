import { describe, it, expect } from 'vitest';
import { NGFFResolver } from '../src/resolver';
import type { D3Node } from '../src/types';

describe('NGFFResolver', () => {
  const source = 'https://example.com/graph';

  describe('constructor', () => {
    it('should append zarr.json if source does not end with .json (source without final slash)', () => {
      const resolver = new NGFFResolver('https://example.com/graph');
      expect(resolver['source']).toBe('https://example.com/graph/zarr.json');
      expect(resolver['prefix']).toBe('https://example.com/graph');
    });

    it('should append zarr.json if source does not end with .json (source with final slash)', () => {
      const resolver = new NGFFResolver('https://example.com/graph/');
      expect(resolver['source']).toBe('https://example.com/graph/zarr.json');
      expect(resolver['prefix']).toBe('https://example.com/graph');
    });

    it('should preserve original source if it ends with .json', () => {
      const resolver = new NGFFResolver('https://example.com/graph/data.json');
      expect(resolver['source']).toBe('https://example.com/graph/data.json');
      expect(resolver['prefix']).toBe('https://example.com/graph');
    });
  });

  describe('resolvePath', () => {
    it('both relative, parent is root', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolvePath('./', './plate/well-A1/well.json');
      expect(path).toEqual('./plate/well-A1/well.json');
    });

    it('both relative, parent is not root', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolvePath('./plate/well-A1', './1_corrected');
      expect(path).toEqual('./plate/well-A1/1_corrected');
    });

    it('child is URL', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolvePath('./', 'https://example.com/resolver/zarr.json');
      expect(path).toEqual('https://example.com/resolver/zarr.json');
    });

    it('parent is URL without final /', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolvePath('https://example.com/resolver', './zarr.json');
      expect(path).toEqual('https://example.com/resolver/zarr.json');
    });

    it('parent is URL with final /', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolvePath('https://example.com/resolver/', './zarr.json');
      expect(path).toEqual('https://example.com/resolver/zarr.json');
    });

    it('parent is .', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolvePath('.', './zarr.json');
      expect(path).toEqual('./zarr.json');
    });

    it('.. is not supported', () => {
      const resolver = new NGFFResolver(source);
      expect(() => resolver.resolvePath('https://example.com/resolver', '../zarr.json')).toThrow(
        'Unsupported path "../zarr.json"'
      );
    });

    it('protocol not supported', () => {
      const resolver = new NGFFResolver(source);
      expect(() =>
        resolver.resolvePath('https://example.com/resolver', 'ftp://example.com/resolver/zarr.json')
      ).toThrow('Unsupported path "ftp://example.com/resolver/zarr.json"');
    });

    it('absolute path not supported', () => {
      const resolver = new NGFFResolver(source);
      expect(() => resolver.resolvePath('https://example.com/resolver', '/zarr.json')).toThrow(
        'Unsupported path "/zarr.json"'
      );
    });
  });

  describe('resolveNode', () => {
    it('resolve node with relative path - zarr type', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolveNode(
        {
          resolvedPath: './zarr.json',
          omeNode: {
            path: {
              type: 'zarr',
              format: 'relative',
              href: './0'
            }
          }
        } as D3Node,
        true
      );
      expect(path).toEqual('https://example.com/graph/0/zarr.json');
    });

    it('resolve node with relative path - json type', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolveNode(
        {
          resolvedPath: './zarr.json',
          omeNode: {
            path: {
              type: 'json',
              format: 'relative',
              href: './0/node.json'
            }
          }
        } as D3Node,
        true
      );
      expect(path).toEqual('https://example.com/graph/0/node.json');
    });

    it('resolve node with absolute path - zarr type', () => {
      const resolver = new NGFFResolver(source);
      const path = resolver.resolveNode(
        {
          resolvedPath: './zarr.json',
          omeNode: {
            path: {
              type: 'zarr',
              format: 'http',
              href: 'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/main/data/e01_inlined_multiscale'
            }
          }
        } as D3Node,
        true
      );
      expect(path).toEqual(
        'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/main/data/e01_inlined_multiscale/zarr.json'
      );
    });
  });
});
