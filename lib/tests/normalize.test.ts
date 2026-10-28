import { describe, it, expect } from 'vitest';
import { normalizeDocument } from '../src/normalize';

describe('normalizeDocument', () => {
  it('renames structural camelCase keys to snake_case', () => {
    const out: any = normalizeDocument({
      version: '0.x',
      extensionManifest: [
        {
          id: 'https://e.org/ext/',
          version: '1',
          mustUnderstand: true,
          schemas: [{ type: 'json_schema', url: 'https://e.org/ext/s.json' }]
        }
      ],
      type: 'collection',
      id: 'c',
      traits: [
        { type: 'well', rowIndex: 0, columnIndex: 1 },
        { type: 'labels', labelAttributes: [{ labelValue: 1, rgba: [1, 2, 3, 4] }] },
        { type: 'scene', coordinateSystems: [], coordinateTransformations: [] }
      ],
      nodes: [
        {
          type: 'multiscale',
          id: 'm',
          coordinateSystems: [{ id: 'cs', axes: [] }],
          scales: [{ id: 's', coordinateTransformations: [] }]
        }
      ]
    });
    expect(out.extension_manifest[0].must_understand).toBe(true);
    expect(out.extension_manifest[0].schemas[0].type).toBe('jsonschema');
    expect(out.extensionManifest).toBeUndefined();
    expect(out.traits[0]).toEqual({ type: 'well', row_index: 0, column_index: 1 });
    expect(out.traits[1].label_attributes[0].label_value).toBe(1);
    expect(out.traits[2]).toEqual({
      type: 'scene',
      coordinate_systems: [],
      coordinate_transformations: []
    });
    expect(out.nodes[0].coordinate_systems).toHaveLength(1);
    expect(out.nodes[0].scales[0].coordinate_transformations).toEqual([]);
  });

  it('leaves snake_case documents and extension trait payloads untouched', () => {
    const input = {
      type: 'collection',
      id: 'c',
      traits: [
        { type: 'https://e.org/ext/rendering', contrastLimits: [0, 1], labelValue: 'keep-me' }
      ],
      nodes: [{ type: 'multiscale', id: 'm', coordinate_systems: [], scales: [] }],
      attributes: { legacy: true }
    };
    expect(normalizeDocument(input)).toEqual(input);
  });
});
