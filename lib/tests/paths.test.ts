import { describe, it, expect } from 'vitest';
import {
  documentDirectory,
  documentUrlFor,
  isDocumentPathType,
  metaUrlForSource,
  resolveHref
} from '../src/paths';

const DOC = 'https://example.com/data/coll/zarr.json';

describe('resolveHref', () => {
  it('relative href against a zarr.json document', () => {
    expect(resolveHref({ type: 'zarr', format: 'relative', href: './raw' }, DOC)).toBe(
      'https://example.com/data/coll/raw'
    );
  });

  it('relative href against a standalone json document', () => {
    expect(
      resolveHref(
        { type: 'zarr', format: 'relative', href: './nuclei' },
        'https://example.com/data/coll/labels.json'
      )
    ).toBe('https://example.com/data/coll/nuclei');
  });

  it('relative href without ./ prefix and nested segments', () => {
    expect(resolveHref({ type: 'zarr', format: 'relative', href: 'A/1/0' }, DOC)).toBe(
      'https://example.com/data/coll/A/1/0'
    );
  });

  it('relative href with ..', () => {
    expect(resolveHref({ type: 'zarr', format: 'relative', href: '../img' }, DOC)).toBe(
      'https://example.com/data/img'
    );
  });

  it('relative href must not contain a scheme', () => {
    expect(() =>
      resolveHref({ type: 'zarr', format: 'relative', href: 'https://other.org/x' }, DOC)
    ).toThrow('Relative path "https://other.org/x" must not contain a URL scheme');
  });

  it('http href is returned as-is', () => {
    expect(
      resolveHref(
        { type: 'zarr', format: 'http', href: 'https://other.org/data/ref.ome.zarr' },
        DOC
      )
    ).toBe('https://other.org/data/ref.ome.zarr');
  });

  it('http format requires an http(s) URL', () => {
    expect(() => resolveHref({ type: 'zarr', format: 'http', href: './raw' }, DOC)).toThrow(
      'Path "./raw" with format "http" must be an http(s) URL'
    );
    expect(() =>
      resolveHref({ type: 'zarr', format: 'http', href: 'ftp://other.org/raw' }, DOC)
    ).toThrow('must be an http(s) URL');
  });

  it('absolute href resolves on the same origin', () => {
    expect(resolveHref({ type: 'zarr', format: 'absolute', href: '/other/img' }, DOC)).toBe(
      'https://example.com/other/img'
    );
    expect(() => resolveHref({ type: 'zarr', format: 'absolute', href: 'other/img' }, DOC)).toThrow(
      'Absolute path "other/img" must start with "/"'
    );
  });

  it('unknown format', () => {
    expect(() => resolveHref({ type: 'zarr', format: 's3', href: 's3://b/k' }, DOC)).toThrow(
      'Unsupported path format "s3" (supported: relative, absolute, http)'
    );
  });
});

describe('documentUrlFor', () => {
  it('zarr paths point to the zarr.json of the group', () => {
    expect(documentUrlFor({ type: 'zarr', format: 'relative', href: './raw' }, DOC)).toBe(
      'https://example.com/data/coll/raw/zarr.json'
    );
    expect(documentUrlFor({ type: 'zarr', format: 'relative', href: './raw/' }, DOC)).toBe(
      'https://example.com/data/coll/raw/zarr.json'
    );
    expect(
      documentUrlFor({ type: 'zarr', format: 'http', href: 'https://o.org/x.zarr/zarr.json' }, DOC)
    ).toBe('https://o.org/x.zarr/zarr.json');
  });

  it('json paths point to the file itself', () => {
    expect(documentUrlFor({ type: 'json', format: 'relative', href: './labels.json' }, DOC)).toBe(
      'https://example.com/data/coll/labels.json'
    );
  });

  it('extension path types are data, not documents', () => {
    expect(
      documentUrlFor(
        { type: 'https://e.org/ext/csv', format: 'relative', href: './A/1/regionprops.csv' },
        DOC
      )
    ).toBeUndefined();
    expect(isDocumentPathType('zarr')).toBe(true);
    expect(isDocumentPathType('json')).toBe(true);
    expect(isDocumentPathType('https://e.org/ext/csv')).toBe(false);
  });
});

describe('metaUrlForSource', () => {
  it('keeps json sources', () => {
    expect(metaUrlForSource('https://example.com/graph/data.json')).toBe(
      'https://example.com/graph/data.json'
    );
  });

  it('appends zarr.json with or without trailing slash', () => {
    expect(metaUrlForSource('https://example.com/graph/')).toBe(
      'https://example.com/graph/zarr.json'
    );
    expect(metaUrlForSource('https://example.com/graph')).toBe(
      'https://example.com/graph/zarr.json'
    );
  });
});

describe('documentDirectory', () => {
  it('strips the metadata file name', () => {
    expect(documentDirectory(DOC)).toBe('https://example.com/data/coll');
    expect(documentDirectory('https://example.com/data/labels.json')).toBe(
      'https://example.com/data'
    );
  });
});
