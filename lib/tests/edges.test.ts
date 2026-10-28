import { describe, it, expect } from 'vitest';
import { labelsSourceEdges } from '../src/edges';
import type { D3Node } from '../src/types';

function d3node(id: string, omeId: string, traits?: unknown[]): D3Node {
  return {
    id,
    parentId: null,
    documentUrl: 'https://example.com/zarr.json',
    omeNode: { type: 'multiscale', id: omeId, ...(traits ? { traits } : {}) } as any,
    loading: false,
    loaded: true,
    error: false,
    collapsed: false
  };
}

describe('labelsSourceEdges', () => {
  it('links label images to their sources when the source is in the graph', () => {
    const nodes = [
      d3node('1', 'a'),
      d3node('2', 'b', [
        {
          type: 'labels',
          source: [
            { type: 'multiscale', ref: 'a' },
            { type: 'multiscale', ref: 'missing' }
          ]
        }
      ]),
      d3node('3', 'c', [{ type: 'labels' }])
    ];
    expect(labelsSourceEdges(nodes)).toEqual([{ sourceId: '2', targetId: '1' }]);
  });
});
