import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NGFFLoader } from '../src/loader';
import { NGFFGraph } from '../src/graph';
import { NGFFSidebar } from '../src/sidebar';
import '@testing-library/jest-dom/vitest';

const { FetchStore } = vi.hoisted(() => {
  return {
    FetchStore: vi.fn(class {})
  };
});

const { NgffImage } = vi.hoisted(() => {
  return {
    NgffImage: {
      async load() {
        return {
          render: async () => 'mock-image',
          getScales: vi.fn(),
          getShape: vi.fn(),
          calcShapes: vi.fn()
        };
      }
    }
  };
});

vi.mock('zarrita', () => {
  return { FetchStore };
});
vi.mock('ome-zarr.js', () => {
  return { NgffImage };
});

const singlescale = {
  type: 'singlescale',
  name: 'high-res',
  id: 'd3f91d97-cf73-4bbf-aaea-d72d8a6ceca0',
  attributes: {
    coordinateTransformations: [
      {
        input: {
          id: 'd3f91d97-cf73-4bbf-aaea-d72d8a6ceca0'
        },
        output: {
          id: '36e2f255-57f0-4b47-9479-3bd63fe1c5ea'
        },
        type: 'scale',
        scale: [1, 1]
      }
    ]
  },
  path: {
    type: 'zarr',
    path: './1'
  }
};

const multiscale = {
  type: 'multiscale',
  name: 'my multiscale',
  id: '2fc172e1-8a87-41fa-9b01-d361dfe60874',
  attributes: {
    coordinateSystems: [
      {
        id: '36e2f255-57f0-4b47-9479-3bd63fe1c5ea',
        axes: [
          {
            name: 'y',
            type: 'space',
            unit: 'micrometer'
          },
          {
            name: 'x',
            type: 'space',
            unit: 'micrometer'
          }
        ]
      }
    ]
  }
};

const collection = {
  type: 'collection',
  version: '0.x',
  name: 'My dataset',
  id: 'a362bc11-0d35-48e7-a058-3c311b398120'
};

describe('NGFFSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('showInfo', () => {
    it('multiscale, in-line child, resolvedPath is relative path', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ome: {
            ...collection,
            nodes: [{ ...multiscale, nodes: [singlescale] }]
          }
        })
      });
      const loader = new NGFFLoader('https://example.com/graph/root.json');
      const graph = new NGFFGraph(loader, 0);
      await graph.loadRoot();
      await graph.loadNode(graph['nodes'][1] as any);

      const element = document.createElement('div');
      const sidebar = new NGFFSidebar(element, graph);
      sidebar.showInfo(graph['nodes'][1]);

      expect(element).toHaveTextContent('Id: 2fc172e1-8a87-41fa-9b01-d361dfe60874');
      expect(element).toHaveTextContent('Name: my multiscale');
      await vi.waitFor(() => {
        expect(element.querySelector('img')).toHaveAttribute('src', 'mock-image');
      });
      expect(FetchStore).toHaveBeenCalledWith('https://example.com/graph');
    });

    it('multiscale, no in-line children, resolvedPath is relative path', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ome: {
              ...collection,
              nodes: [{ ...multiscale, path: { type: 'zarr', path: './0' } }]
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ome: {
              ...multiscale,
              nodes: [singlescale]
            }
          })
        });
      const loader = new NGFFLoader('https://example.com/graph/');
      const graph = new NGFFGraph(loader, 0);
      await graph.loadRoot();
      await graph.loadNode(graph['nodes'][1] as any);

      const element = document.createElement('div');
      const sidebar = new NGFFSidebar(element, graph);
      sidebar.showInfo(graph['nodes'][1]);

      expect(element).toHaveTextContent('Id: 2fc172e1-8a87-41fa-9b01-d361dfe60874');
      expect(element).toHaveTextContent('Name: my multiscale');
      await vi.waitFor(() => {
        expect(element.querySelector('img')).toHaveAttribute('src', 'mock-image');
      });
      expect(FetchStore).toHaveBeenCalledWith('https://example.com/graph/0');
    });

    it('multiscale, no in-line children, resolvedPath is URL', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ome: {
              ...collection,
              path: { type: 'json', path: 'https://example.com/collection.json' }
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ome: {
              ...collection,
              nodes: [
                {
                  ...multiscale,
                  path: { type: 'zarr', path: 'https://example.com/multiscale.json' }
                }
              ]
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ome: {
              ...multiscale,
              nodes: [singlescale]
            }
          })
        });
      const loader = new NGFFLoader('https://example.com/');
      const graph = new NGFFGraph(loader, 0);
      await graph.loadRoot();
      await graph.loadNode(graph['nodes'][0] as any);
      await graph.loadNode(graph['nodes'][1] as any);

      const element = document.createElement('div');
      const sidebar = new NGFFSidebar(element, graph);
      sidebar.showInfo(graph['nodes'][1]);

      expect(element).toHaveTextContent('Id: 2fc172e1-8a87-41fa-9b01-d361dfe60874');
      expect(element).toHaveTextContent('Name: my multiscale');
      await vi.waitFor(() => {
        expect(element.querySelector('img')).toHaveAttribute('src', 'mock-image');
      });
      expect(FetchStore).toHaveBeenCalledWith('https://example.com/multiscale.json');
    });
  });
});
