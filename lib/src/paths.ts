import { DOCUMENT_PATH_TYPES, PATH_FORMATS, ZARR_METADATA_FILE } from './constants';

/** Minimal shape of an RFC-8 revision 1 path object. */
export type PathLike = { type: string; format: string; href: string };

/**
 * Resolves a path object to an absolute URL. `documentUrl` is the URL of the metadata file
 * (`.../zarr.json` or `.../something.json`) of the document that contains the path: relative hrefs
 * are resolved against its directory, as `urljoin` does. The format is never inferred from the href.
 */
export function resolveHref(path: PathLike, documentUrl: string): string {
  switch (path.format) {
    case 'relative':
      if (path.href.includes('://')) {
        throw new Error(`Relative path "${path.href}" must not contain a URL scheme`);
      }
      return new URL(path.href, documentUrl).href;
    case 'absolute':
      // Interpreted as an absolute path on the same origin as the document; this is the only reading
      // that can work in a browser.
      if (!path.href.startsWith('/')) {
        throw new Error(`Absolute path "${path.href}" must start with "/"`);
      }
      return new URL(path.href, documentUrl).href;
    case 'http':
      if (!/^https?:\/\//.test(path.href)) {
        throw new Error(`Path "${path.href}" with format "http" must be an http(s) URL`);
      }
      return path.href;
    default:
      throw new Error(
        `Unsupported path format "${path.format}" (supported: ${PATH_FORMATS.join(', ')})`
      );
  }
}

/** True when the path points to an RFC-8 document (`zarr` group or standalone `json`). */
export function isDocumentPathType(type: string): boolean {
  return (DOCUMENT_PATH_TYPES as readonly string[]).includes(type);
}

/**
 * Absolute URL of the metadata file the path resolves to, or `undefined` when the path is a data
 * locator (extension path type) rather than a document.
 */
export function documentUrlFor(path: PathLike, documentUrl: string): string | undefined {
  if (!isDocumentPathType(path.type)) {
    return undefined;
  }
  const resolved = resolveHref(path, documentUrl);
  if (path.type === 'json') {
    return resolved;
  }
  return withZarrMetadataFile(resolved);
}

/** Normalizes a user-provided source into the URL of a metadata file. */
export function metaUrlForSource(source: string): string {
  if (source.endsWith('.json')) {
    return source;
  }
  return withZarrMetadataFile(source);
}

/** Directory URL of a metadata file (`https://h/x/zarr.json` -> `https://h/x`). */
export function documentDirectory(metaUrl: string): string {
  return metaUrl.replace(/\/[^/]*\.json$/, '');
}

function withZarrMetadataFile(url: string): string {
  if (url.endsWith(`/${ZARR_METADATA_FILE}`)) {
    return url;
  }
  return `${url.replace(/\/$/, '')}/${ZARR_METADATA_FILE}`;
}
