import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NGFFLoader } from '../src/loader';
import type { OmeNode } from '../src/types';

describe('NGFFLoader', () => {
  const validOmeNode: OmeNode = {
    type: 'collection',
    name: 'test',
    id: 'test',
    nodes: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should append zarr.json if source does not end with .json', () => {
      const loader = new NGFFLoader('https://example.com/graph/');
      expect(loader['source']).toBe('https://example.com/graph/zarr.json');
      expect(loader['prefix']).toBe('https://example.com/graph');
    });

    it('should preserve original source if it ends with .json', () => {
      const loader = new NGFFLoader('https://example.com/graph/data.json');
      expect(loader['source']).toBe('https://example.com/graph/data.json');
      expect(loader['prefix']).toBe('https://example.com/graph');
    });

    it('should throw error for invalid URL in constructor', async () => {
      expect(() => new NGFFLoader('not-a-valid-url')).toThrow('Source is not a valid URL');
    });

    it('should throw error for unsupported protocol in constructor', async () => {
      expect(() => new NGFFLoader('ftp://example.com/image.json')).toThrow(
        'Protocol ftp: is not supported'
      );
    });
  });

  describe('loadGraphData', () => {
    it('should successfully load graph data from valid URL', async () => {
      const source = 'https://example.com/zarr.json';
      const loader = new NGFFLoader(source);
      mockValidOmeResponse();
      const result = await loader.loadGraphData();
      expect(result).toEqual(validOmeNode);
      expect(global.fetch).toHaveBeenCalledWith(source, expect.anything());
    });
  });

  describe('loadNode', () => {
    it('should throw error for invalid URL in child node', async () => {
      const source = 'https://example.com/zarr.json';
      const loader = new NGFFLoader(source);
      await expect(() => loader.loadNode('not-a-valid-url')).rejects.toThrow(
        'Source is not a valid URL'
      );
    });

    it('should throw error for invalid protocol in child node', async () => {
      const source = 'https://example.com/zarr.json';
      const loader = new NGFFLoader(source);
      await expect(() => loader.loadNode('ftp://example.com/image.json')).rejects.toThrow(
        'Protocol ftp: is not supported'
      );
    });

    it('should load node with absolute URL and valid prefix', async () => {
      const loader = new NGFFLoader('https://example.com/data');
      const nodeUrl = 'https://example.com/data/other/node.json';
      mockValidOmeResponse();
      const result = await loader.loadNode(nodeUrl);
      expect(result).toEqual(validOmeNode);
      expect(global.fetch).toHaveBeenCalledWith(nodeUrl, expect.anything());
    });

    it('should resolve relative paths starting with ./', async () => {
      const loader = new NGFFLoader('https://example.com/data/image.json');
      mockValidOmeResponse();
      await loader.loadNode('./subdir/node.json');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/data/subdir/node.json',
        expect.anything()
      );
    });

    it('should throw error on failed fetch response', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(loader.loadNode('https://example.com/image.json')).rejects.toThrow(
        /Unexpected response from server while loading.*Status: 404/
      );
    });

    it('should throw error on invalid JSON response', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(loader.loadNode('https://example.com/image.json')).rejects.toThrow(
        /Unable to load.*invalid JSON content/
      );
    });

    it('should handle trusted and untrusted domains', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');
      const externalSource = 'https://fractal.org/image.json';
      mockValidOmeResponse();
      await expect(loader.loadNode(externalSource)).rejects.toThrow(
        /The domain fractal.org is not trusted/
      );
      loader.addTrustedDomain('fractal.org');
      await loader.loadNode(externalSource);
      expect(global.fetch).toHaveBeenCalledWith(externalSource, expect.anything());
    });
  });

  describe('getOme', () => {
    it('should return ome property if it exists at top level', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');
      mockValidOmeResponse();
      const result = await loader.loadGraphData();
      expect(result).toEqual(validOmeNode);
    });

    it('should return ome property from attributes if it exists there', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ attributes: { ome: validOmeNode } })
      });
      const result = await loader.loadGraphData();
      expect(result).toEqual(validOmeNode);
    });

    it('should prefer top-level ome over attributes.ome', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');
      const topLevelOme = { ...validOmeNode, name: 'top-level' };
      const attributesOme = { ...validOmeNode, name: 'attributes' };
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ome: topLevelOme,
          attributes: { ome: attributesOme }
        })
      });
      const result = await loader.loadGraphData();
      expect(result).toEqual(topLevelOme);
    });

    it('should throw error if ome field is missing', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await expect(loader.loadGraphData()).rejects.toThrow('Payload does not contain ome field');
    });

    it('should throw error if attributes exists but does not contain ome', async () => {
      const loader = new NGFFLoader('https://example.com/image.json');
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ attributes: {} })
      });

      await expect(loader.loadGraphData()).rejects.toThrow('Payload does not contain ome field');
    });
  });

  function mockValidOmeResponse() {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ome: validOmeNode })
    });
  }
});
