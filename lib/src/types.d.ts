export type OmeNodeAttributes = Record<string, any> & {
  labels?: LabelsAttribute;
  scene?: SceneAttribute;
};

export type LabelsAttribute = {
  source?: Array<{ id: string }>;
  labelAttributes?: Array<{
    labelValue: number;
    color?: number[];
  }>;
};

export type SceneAttribute = {
  coordinateSystems?: CoordinateSystem[];
  coordinateTransformations: CoordinateTransformation[];
};

export type OmePath = {
  type: string;
  path: string;
};

export type OmeReference = {
  id: string;
  path?: OmePath;
};

export type BaseOmeNode = {
  type: string;
  id?: string;
  name: string;
  nodes?: OmeNode[];
  attributes?: OmeNodeAttributes;
};

export type CollectionOmeNode = {
  type: 'collection';
  id?: string;
  name: string;
  attributes?: OmeNodeAttributes;
} & (
  | {
      nodes: OmeNode[];
    }
  | {
      path: OmePath;
    }
);

export type CoordinateTransformation = {
  type: string;
  input: OmeReference;
  output: OmeReference;
  translation?: number[];
};

export type SinglescaleOmeNode = {
  type: 'singlescale';
  id?: string;
  name: string;
  path?: OmePath;
  attributes: OmeNodeAttributes & {
    coordinateTransformations: CoordinateTransformation[];
  };
};

export type CoordinateSystem = {
  id: string;
  name?: string;
  axes: string[];
};

export type MultiscaleOmeNode = {
  type: 'multiscale';
  id?: string;
  name: string;
  attributes: OmeNodeAttributes & {
    coordinateSystems: Record<any, any>;
  };
} & (
  | {
      nodes: SinglescaleOmeNode[];
    }
  | {
      path?: OmePath;
    }
);

export type OmeNode = BaseOmeNode | CollectionOmeNode | SinglescaleOmeNode | MultiscaleOmeNode;

export type Collection = {
  ome: OmeNode & {
    version: string;
  };
};

export type D3Node = {
  id: string;
  omeId?: string;
  name: string;
  type: string;
  parentId: string | null;
  attributes: any;
  path?: OmePath;
  resolvedPath: string;
  loading: boolean;
  expanded: boolean;
  error: boolean;
};

export type ExtraEdgesFn = (
  node: OmeNode,
  extraEdges: Array<{ sourceId: string; targetId: string }>
) => void;
