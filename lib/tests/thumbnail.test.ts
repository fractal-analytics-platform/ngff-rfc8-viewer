import { describe, it, expect } from 'vitest';
import { buildMultiscaleAttrs } from '../src/thumbnail';
import type { OmeNode } from '../src/types';

const DOC = 'https://example.com/coll/raw/zarr.json';
const CS_A = '0192f3a0-7c1e-7b00-9c22-000000000020';
const CS_B = '0192f3a0-7c1e-7b00-9c22-000000000021';

function node(overrides: Partial<OmeNode> = {}): OmeNode {
  return {
    type: 'multiscale',
    id: '0192f3a0-7c1e-7b00-9c22-000000000002',
    coordinate_systems: [
      {
        type: 'coordinate_system',
        id: CS_A,
        axes: [{ name: 'c', type: 'channel' }, { name: 'y' }]
      },
      {
        type: 'coordinate_system',
        id: CS_B,
        name: 'physical',
        axes: [{ name: 'y' }, { name: 'x' }]
      }
    ],
    scales: [
      {
        type: 'scale',
        id: 's0',
        path: { type: 'zarr', format: 'relative', href: './s0' },
        coordinate_transformations: [
          { type: 'translation', translation: [0, 10], input: { type: 'scale', ref: 's0' } },
          {
            type: 'scale',
            scale: [1, 1],
            input: { type: 'scale', ref: 's0' },
            output: { type: 'coordinate_system', ref: CS_B }
          }
        ]
      },
      {
        type: 'scale',
        id: 's1',
        path: { type: 'zarr', format: 'http', href: 'https://idr.org/img.zarr/1' },
        coordinate_transformations: [{ type: 'scale', scale: [2, 2] }]
      }
    ],
    ...overrides
  };
}

describe('buildMultiscaleAttrs', () => {
  it('uses the coordinate system referenced by the first scale and keeps axes verbatim', () => {
    const attrs = buildMultiscaleAttrs(node(), DOC);
    expect(attrs.ome.version).toBe('0.5');
    expect(attrs.ome.multiscales[0].axes).toEqual([{ name: 'y' }, { name: 'x' }]);
  });

  it('falls back to the first coordinate system when the reference does not resolve', () => {
    const n = node();
    n.scales![0].coordinate_transformations[1].output = { type: 'coordinate_system', ref: 'nope' };
    expect(buildMultiscaleAttrs(n, DOC).ome.multiscales[0].axes[0].name).toBe('c');
  });

  it('resolves scale hrefs to absolute URLs and strips input/output from transformations', () => {
    const datasets = buildMultiscaleAttrs(node(), DOC).ome.multiscales[0].datasets;
    expect(datasets).toHaveLength(2);
    expect(datasets[0]).toEqual({
      path: 'https://example.com/coll/raw/s0',
      coordinateTransformations: [
        { type: 'translation', translation: [0, 10] },
        { type: 'scale', scale: [1, 1] }
      ]
    });
    expect(datasets[1]).toEqual({
      path: 'https://idr.org/img.zarr/1',
      coordinateTransformations: [{ type: 'scale', scale: [2, 2] }]
    });
  });

  it('throws descriptive errors when the multiscale is incomplete', () => {
    expect(() => buildMultiscaleAttrs(node({ scales: undefined }), DOC)).toThrow(
      'Multiscale has no scales (document not loaded?)'
    );
    expect(() => buildMultiscaleAttrs(node({ coordinate_systems: [] }), DOC)).toThrow(
      'Multiscale has no coordinate systems'
    );
    const n = node();
    n.scales![1].coordinate_transformations = [];
    expect(() => buildMultiscaleAttrs(n, DOC)).toThrow(
      'Scale "s1" (https://idr.org/img.zarr/1) has no scale transformation'
    );
  });
});
