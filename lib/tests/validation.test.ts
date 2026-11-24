import { describe, it, expect } from 'vitest';
import { validateRequiredOmeStructure } from '../src/validation.ts';

describe('validation', () => {
  it('valid collection with path nodes', () => {
    expect(() =>
      validateRequiredOmeStructure({
        version: '0.x',
        type: 'collection',
        name: 'My Dataset',
        id: 'dataset',
        nodes: [
          {
            type: 'collection',
            name: 'My Plate',
            id: 'plate',
            path: {
              type: 'json',
              format: 'relative',
              href: './plate/plate.json'
            }
          }
        ]
      })
    ).not.toThrow();
  });

  it('missing type', () => {
    expect(() => validateRequiredOmeStructure({})).toThrow(
      'Invalid field at root.type: must be a non-empty string'
    );
  });

  it('missing name', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection'
      })
    ).toThrow('Invalid field at root.name: must be a non-empty string');
  });

  it('invalid id', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        name: 'foo',
        id: ''
      })
    ).toThrow('Invalid field at root.id: must be a string or undefined');
  });

  it('invalid coordinateTransformations type', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'multiscale',
        name: 'foo',
        coordinateTransformations: {}
      })
    ).toThrow('Invalid field at root.coordinateTransformations: must be an array');
  });

  it('invalid coordinateSystems type', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'multiscale',
        name: 'foo',
        coordinateSystems: {}
      })
    ).toThrow('Invalid field at root.coordinateSystems: must be an array');
  });

  it('invalid path', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        name: 'foo',
        id: 'foo',
        path: './foo'
      })
    ).toThrow('Invalid field at root.path: must be an object');
  });

  it('missing path.type', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        name: 'foo',
        id: 'foo',
        path: { path: './foo' }
      })
    ).toThrow('Invalid field at root.path: missing type field');
  });

  it('missing path.href', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        name: 'foo',
        id: 'foo',
        path: { type: 'zarr' }
      })
    ).toThrow('Invalid field at root.path: missing href field');
  });

  it('invalid path.type', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        name: 'foo',
        id: 'foo',
        path: { type: [], path: './foo' }
      })
    ).toThrow('Invalid field at root.path.type: must be a non-empty string');
  });

  it('invalid path.href', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        name: 'foo',
        id: 'foo',
        path: { type: 'zarr', href: [] }
      })
    ).toThrow('Invalid field at root.path.href: must be a non-empty string');
  });

  it('invalid multiscale: found both nodes and path', () => {
    expect(() =>
      validateRequiredOmeStructure({
        type: 'collection',
        name: 'foo',
        nodes: [
          {
            type: 'multiscale',
            name: 'multi',
            attributes: {
              coordinateSystems: [{ id: 'coord', axes: [] }]
            },
            nodes: [],
            path: {
              type: 'json',
              path: './plate/plate.json'
            }
          }
        ]
      })
    ).toThrow(
      'Invalid field at root.nodes[0]: found both nodes and path fields, but only one must be present'
    );
  });
});
