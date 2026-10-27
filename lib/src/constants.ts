export const CSS_CLASS_PREFIX = 'ngff-rfc8-viewer-';

export const NODE_COLORS: Record<string, string> = {
  collection: '#4f81bd',
  multiscale: '#9bbb59',
  singlescale: '#c0504d',
  default: '#999'
};

export const STROKE_COLORS: Record<string, string> = {
  selection: '#333',
  inlining: '#8e009b',
  remote: '#ddd',
  local: '#555'
};

/** Path formats defined by RFC-8 revision 1 (`relative` is core; the others come from a sub-RFC). */
export const PATH_FORMATS = ['relative', 'absolute', 'http'] as const;

/** Path types whose target is an RFC-8 document (anything else is a data locator). */
export const DOCUMENT_PATH_TYPES = ['zarr', 'json'] as const;

export const ZARR_METADATA_FILE = 'zarr.json';
