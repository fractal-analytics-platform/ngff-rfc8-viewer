import { describe, it, expect } from 'vitest';
import {
  detectLegacyFormat,
  LegacyFormatError,
  validateRequiredOmeStructure
} from '../src/validation.ts';

const UUID = '0192f3a0-7c1e-7b00-9c22-000000000001';
const UUID2 = '0192f3a0-7c1e-7b00-9c22-000000000002';

const multiscaleDocument = {
  version: '0.x',
  type: 'multiscale',
  id: UUID2,
  name: 'raw',
  coordinate_systems: [
    {
      type: 'coordinate_system',
      id: '0192f3a0-7c1e-7b00-9c22-000000000020',
      axes: [
        { name: 'y', type: 'space', unit: 'micrometer' },
        { name: 'x', type: 'space', unit: 'micrometer' }
      ]
    }
  ],
  scales: [
    {
      type: 'scale',
      id: '0192f3a0-7c1e-7b00-9c22-00000000000c',
      path: { type: 'zarr', format: 'relative', href: './s0' },
      coordinate_transformations: [
        {
          type: 'scale',
          scale: [1, 1],
          input: { type: 'scale', ref: '0192f3a0-7c1e-7b00-9c22-00000000000c' },
          output: { type: 'coordinate_system', ref: '0192f3a0-7c1e-7b00-9c22-000000000020' }
        }
      ]
    }
  ],
  nodes: []
};

describe('validateRequiredOmeStructure', () => {
  it('valid collection with path nodes and traits', () => {
    expect(() =>
      validateRequiredOmeStructure({
        version: '0.x',
        type: 'collection',
        id: UUID,
        name: 'My Dataset',
        traits: [{ type: 'plate', rows: [{ name: 'A' }], columns: [{ name: '1' }] }],
        extension_manifest: [
          {
            id: 'https://example.org/ext/',
            version: '1.0',
            schemas: [{ type: 'jsonschema', url: 'https://example.org/ext/schema.json' }]
          }
        ],
        nodes: [
          {
            type: 'collection',
            id: UUID2,
            path: { type: 'json', format: 'relative', href: './plate/plate.json' }
          },
          {
            type: 'multiscale',
            id: '0192f3a0-7c1e-7b00-9c22-000000000003',
            name: 'raw',
            path: { type: 'zarr', format: 'http', href: 'https://example.org/raw.zarr' },
            traits: [{ type: 'https://example.org/ext/rendering', contrast_limits: [0, 1] }]
          },
          {
            type: 'https://example.org/ext/table',
            id: '0192f3a0-7c1e-7b00-9c22-000000000004',
            path: { type: 'https://example.org/ext/csv', format: 'relative', href: './t.csv' }
          }
        ]
      })
    ).not.toThrow();
  });

  it('valid multiscale document (with empty nodes list)', () => {
    expect(() => validateRequiredOmeStructure(multiscaleDocument)).not.toThrow();
  });

  it('missing type', () => {
    expect(() => validateRequiredOmeStructure({ id: UUID })).toThrow(
      'Invalid field at root.type: must be a non-empty string'
    );
  });

  it('missing id', () => {
    expect(() => validateRequiredOmeStructure({ type: 'collection', nodes: [] })).toThrow(
      'Invalid field at root.id: must be a non-empty string'
    );
  });

  it('name is optional but must be a non-empty string when present', () => {
    expect(() =>
      validateRequiredOmeStructure({ type: 'collection', id: UUID, nodes: [] })
    ).not.toThrow();
    expect(() =>
      validateRequiredOmeStructure({ type: 'collection', id: UUID, name: '', nodes: [] })
    ).toThrow('Invalid field at root.name: must be a non-empty string or undefined');
  });

  it('invalid traits', () => {
    expect(() =>
      validateRequiredOmeStructure({ type: 'collection', id: UUID, traits: {}, nodes: [] })
    ).toThrow('Invalid field at root.traits: must be an array');
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        id: UUID,
        traits: [{ rows: [] }],
        nodes: []
      })
    ).toThrow('Invalid field at root.traits[0].type: must be a non-empty string');
  });

  it('nested node errors report their location', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        id: UUID,
        nodes: [{ type: 'collection', id: UUID2, nodes: [{ type: 'multiscale' }] }]
      })
    ).toThrow('Invalid field at root.nodes[0].nodes[0].id: must be a non-empty string');
  });

  it('invalid path', () => {
    const base = { type: 'collection', id: UUID };
    expect(() => validateRequiredOmeStructure({ ...base, path: 'x' })).toThrow(
      'Invalid field at root.path: must be an object'
    );
    expect(() =>
      validateRequiredOmeStructure({ ...base, path: { format: 'relative', href: './x' } })
    ).toThrow('Invalid field at root.path.type: must be a non-empty string');
    expect(() =>
      validateRequiredOmeStructure({ ...base, path: { type: 'zarr', href: './x' } })
    ).toThrow('Invalid field at root.path.format: must be a non-empty string');
    expect(() =>
      validateRequiredOmeStructure({ ...base, path: { type: 'zarr', format: 'ftp', href: './x' } })
    ).toThrow(
      'Invalid field at root.path.format: must be one of relative, absolute, http, got "ftp"'
    );
    expect(() =>
      validateRequiredOmeStructure({ ...base, path: { type: 'zarr', format: 'relative' } })
    ).toThrow('Invalid field at root.path.href: must be a non-empty string');
  });

  it('nodes and path are exclusive', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        id: UUID,
        nodes: [{ type: 'collection', id: UUID2, nodes: [] }],
        path: { type: 'json', format: 'relative', href: './c.json' }
      })
    ).toThrow(
      'Invalid field at root: found both nodes and path fields, but only one must be present'
    );
  });

  it('multiscale nodes cannot have children', () => {
    expect(() =>
      validateRequiredOmeStructure({
        ...multiscaleDocument,
        nodes: [{ type: 'collection', id: UUID, nodes: [] }]
      })
    ).toThrow('Invalid field at root.nodes: multiscale nodes cannot have child nodes');
  });

  it('multiscale document requires coordinate_systems and scales', () => {
    expect(() => validateRequiredOmeStructure({ type: 'multiscale', id: UUID2 })).toThrow(
      'Invalid field at root.coordinate_systems: must be an array'
    );
    expect(() =>
      validateRequiredOmeStructure({ type: 'multiscale', id: UUID2, coordinate_systems: [] })
    ).toThrow('Invalid field at root.scales: must be an array');
    expect(() =>
      validateRequiredOmeStructure({
        ...multiscaleDocument,
        scales: [{ type: 'scale', id: 'x', coordinate_transformations: [] }]
      })
    ).toThrow('Invalid field at root.scales[0].path: must be an object');
    expect(() =>
      validateRequiredOmeStructure({
        ...multiscaleDocument,
        scales: [
          { type: 'scale', id: 'x', path: { type: 'zarr', format: 'relative', href: './s0' } }
        ]
      })
    ).toThrow('Invalid field at root.scales[0].coordinate_transformations: must be an array');
  });

  it('multiscale entry with a path is not required to carry scales', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'multiscale',
        id: UUID2,
        path: { type: 'zarr', format: 'relative', href: './raw' }
      })
    ).not.toThrow();
  });

  it('invalid extension manifest', () => {
    const base = { type: 'collection', id: UUID, nodes: [] };
    expect(() => validateRequiredOmeStructure({ ...base, extension_manifest: {} })).toThrow(
      'Invalid field at root.extension_manifest: must be an array'
    );
    expect(() =>
      validateRequiredOmeStructure({ ...base, extension_manifest: [{ id: 'https://e.org/' }] })
    ).toThrow('Invalid field at root.extension_manifest[0].version: must be a non-empty string');
    expect(() =>
      validateRequiredOmeStructure({
        ...base,
        extension_manifest: [{ id: 'https://e.org/', version: '1' }]
      })
    ).toThrow('Invalid field at root.extension_manifest[0].schemas: must be an array');
  });
});

describe('detectLegacyFormat', () => {
  it('accepts a revision 1 document', () => {
    expect(() => detectLegacyFormat(multiscaleDocument)).not.toThrow();
  });

  it('detects attributes on the root', () => {
    expect(() =>
      detectLegacyFormat({ type: 'collection', id: UUID, name: 'x', attributes: {}, nodes: [] })
    ).toThrow(LegacyFormatError);
    expect(() =>
      detectLegacyFormat({ type: 'collection', id: UUID, name: 'x', attributes: {}, nodes: [] })
    ).toThrow(/pre-revision RFC-8 format \(found "attributes" at root\)/);
  });

  it('detects attributes on a nested node, reporting the location', () => {
    expect(() =>
      detectLegacyFormat({
        type: 'collection',
        id: UUID,
        nodes: [{ type: 'multiscale', id: UUID2, attributes: { coordinateSystems: [] } }]
      })
    ).toThrow(/found "attributes" at root\.nodes\[0\]/);
  });

  it('detects singlescale nodes', () => {
    expect(() =>
      detectLegacyFormat({
        type: 'multiscale',
        id: UUID,
        nodes: [{ type: 'singlescale', id: UUID2, path: { type: 'zarr', href: './0' } }]
      })
    ).toThrow(/found a "singlescale" node at root\.nodes\[0\]/);
  });

  it('detects path.path instead of path.href', () => {
    expect(() =>
      detectLegacyFormat({ type: 'collection', id: UUID, path: { type: 'json', path: './c.json' } })
    ).toThrow(/found "path\.path" instead of "path\.href" at root/);
  });

  it('ignores a key named attributes inside a trait payload', () => {
    expect(() =>
      detectLegacyFormat({
        type: 'collection',
        id: UUID,
        traits: [{ type: 'https://e.org/ext/x', attributes: { a: 1 } }],
        nodes: []
      })
    ).not.toThrow();
  });
});
