/**
 * Types for RFC-8 revision 1 collections metadata.
 * See `rfc8_revision_changes.md` in https://github.com/ome/rfc8-revision1.
 */

export type PathFormat = 'relative' | 'absolute' | 'http';

/** `{type, format, href}` path object. `type` is `zarr`, `json` or an extension URI. */
export type OmePath = {
  type: string;
  format: PathFormat | string;
  href: string;
};

/** Typed reference to an object declared elsewhere (`ref` is the target UUID). */
export type OmeReference = {
  type: string;
  ref: string;
  path?: OmePath;
};

export type Axis = {
  name: string;
  type?: string;
  unit?: string;
  [key: string]: unknown;
};

export type CoordinateSystem = {
  type?: string;
  id: string;
  name?: string;
  axes: Axis[];
};

export type CoordinateTransformation = {
  type: string;
  input?: OmeReference;
  output?: OmeReference;
  // scale OR translation transformation (other types are passed through)
  scale?: number[];
  translation?: number[];
  [key: string]: unknown;
};

/** A resolution level of a multiscale (replaces the pre-revision `singlescale` node). */
export type Scale = {
  type?: string;
  id: string;
  path: OmePath;
  coordinate_transformations: CoordinateTransformation[];
};

/** A trait: a typed object carried in a node's `traits` list. Built-in traits use keywords, extension traits URIs. */
export type Trait = {
  type: string;
  [key: string]: unknown;
};

export type SceneTrait = Trait & {
  type: 'scene';
  coordinate_systems?: CoordinateSystem[];
  coordinate_transformations?: CoordinateTransformation[];
};

export type PlateTrait = Trait & {
  type: 'plate';
  rows: Array<{ name: string }>;
  columns: Array<{ name: string }>;
  acquisitions?: Array<{
    type?: string;
    id: string;
    name?: string;
    starttime?: number;
    endtime?: number;
  }>;
};

export type WellTrait = Trait & {
  type: 'well';
  row_index: number;
  column_index: number;
};

export type AcquisitionTrait = Trait & {
  type: 'acquisition';
  acquisition: OmeReference;
};

export type LabelsTrait = Trait & {
  type: 'labels';
  source?: OmeReference[];
  label_attributes?: Array<{ label_value: number; rgba?: number[] }>;
};

export type SchemaRef = {
  type: string;
  url: string;
};

export type ExtensionManifestEntry = {
  id: string;
  version: string;
  schemas: SchemaRef[];
  name?: string;
  description?: string;
  homepage?: string;
  must_understand?: boolean;
};

/**
 * An RFC-8 node. Core types are `collection` and `multiscale`; extensions use URI types and may
 * carry extra fields. A node declares children (`nodes`) or points to another document (`path`).
 * `coordinate_systems` and `scales` are the multiscale fields (present on a multiscale document, and
 * copied onto the node once the document is fetched).
 */
export type OmeNode = {
  type: string;
  id: string;
  name?: string;
  traits?: Trait[];
  path?: OmePath;
  nodes?: OmeNode[];
  coordinate_systems?: CoordinateSystem[];
  scales?: Scale[];
  [key: string]: unknown;
};

/** The `ome` payload of a document: the root node plus `version` and the extension manifest. */
export type OmeDocument = OmeNode & {
  version: string;
  extension_manifest?: ExtensionManifestEntry[];
};

export type D3Node = {
  /** Internal, generated id used for the d3 hierarchy. */
  id: string;
  omeNode: OmeNode;
  parentId: string | null;
  /** Absolute URL of the metadata file (`.../zarr.json` or `.../x.json`) that declares this node. */
  documentUrl: string;
  /** Absolute URL of the metadata file the node's `path` resolves to, when it points to a document. */
  targetUrl?: string;
  /** Extension manifest of the document this node is the root of (set once the document is known). */
  manifest?: ExtensionManifestEntry[];
  loading: boolean;
  loaded: boolean;
  error: boolean;
  collapsed: boolean;
};

export type ExtraEdge = { sourceId: string; targetId: string };

/** Computes additional (non-hierarchical) edges between graph nodes, e.g. label sources. */
export type ExtraEdgesFn = (nodes: D3Node[]) => ExtraEdge[];
