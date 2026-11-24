import type { Axis } from 'ome-zarr.js';

export type Declaration = {
  id: string;
  type: string;
};

export type OmePath = {
  type: 'zarr' | 'json' | string; // extension point
  format: 'relative' | 'http';
  href: string;
};

export type DownsamplingTransformation =
  | {
      type: 'scale';
      scale: number[];
    }
  | {
      type: 'translation';
      translation: number[];
    };

export type Reference =
  | string
  | {
      type: string;
      ref: string;
      path?: OmePath;
    };

export type Scene = {
  coordinateTransformations: CoordinateTransformation[];
  coordinateSystems?: CoordinateSystem[];
};

export type Trait = Scene;

export type OmeArray = {
  type: 'array';
  name?: string;
  path?: OmePath;
  downsamplingTransformations?: DownsamplingTransformation[];
};

export type OmeNode = BaseOmeNode | CollectionOmeNode | MultiscaleOmeNode;

export type BaseOmeNode = {
  type: string; // extension point
  id: string;
  name?: string;
  traits?: Trait[];
  version?: string;
};

export type CollectionOmeNode = BaseOmeNode & {
  type: 'collection';
} & ({ nodes: OmeNode[] } | { path: OmePath });

export type MultiscaleOmeNode = BaseOmeNode & {
  type: 'multiscale';
  coordinateSystems: CoordinateSystem[];
  coordinateTransformations: CoordinateTransformation[];
} & ({ data: OmeArray[] } | { path: OmePath });

export type CoordinateTransformation = DownsamplingTransformation & {
  type: string;
  input: Reference;
  output: Reference;
};

export type CoordinateSystem = {
  type: 'coordinate_system';
  id: string;
  name?: string;
  axes: Axis[];
};

export type D3Node = {
  id: string; // in case of arrays this is a generated id, otherwise it is the original node id
  parentId: string | null;
  index: number | null; // used only for arrays
  omeNode: OmeNode | OmeArray;
  resolvedPath: string;
  loading: boolean;
  loaded: boolean;
  error: boolean;
  collapsed: boolean;
  selected: boolean;
};

export type ExtraEdgesFn = (
  node: OmeNode | OmeArray,
  extraEdges: Array<{ sourceId: string; targetId: string }>
) => void;
