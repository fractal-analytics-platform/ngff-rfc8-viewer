import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NGFFGraph } from '../src/graph';
import { NGFFLoader } from '../src/loader';
import type { D3Node } from '../src/types';

const ROOT_URL = 'https://example.com/coll/zarr.json';
const ROOT_ID = '0192f3a0-7c1e-7b00-9c22-000000000001';
const RAW_ID = '0192f3a0-7c1e-7b00-9c22-000000000002';
const LABELS_COLL_ID = '0192f3a0-7c1e-7b00-9c22-000000000003';
const NUCLEI_ID = '0192f3a0-7c1e-7b00-9c22-000000000004';
const TABLE_ID = '0192f3a0-7c1e-7b00-9c22-000000000005';
const CS_ID = '0192f3a0-7c1e-7b00-9c22-000000000020';
const SCALE_ID = '0192f3a0-7c1e-7b00-9c22-00000000000c';
const EXT = 'https://example.org/ext/';
const EXT_SUB = 'https://example.org/ext/sub/';

function multiscaleDoc(id: string, name: string, traits?: unknown[]) {
  return {
    attributes: {
      ome: {
        version: '0.x',
        type: 'multiscale',
        id,
        name,
        ...(traits ? { traits } : {}),
        coordinate_systems: [
          { type: 'coordinate_system', id: CS_ID, axes: [{ name: 'y' }, { name: 'x' }] }
        ],
        scales: [
          {
            type: 'scale',
            id: SCALE_ID,
            path: { type: 'zarr', format: 'relative', href: './s0' },
            coordinate_transformations: [
              {
                type: 'scale',
                scale: [1, 1],
                input: { type: 'scale', ref: SCALE_ID },
                output: { type: 'coordinate_system', ref: CS_ID }
              }
            ]
          }
        ],
        nodes: []
      }
    },
    zarr_format: 3,
    node_type: 'group'
  };
}

const rootDoc = {
  attributes: {
    ome: {
      version: '0.x',
      extension_manifest: [
        { id: EXT, version: '1.0', schemas: [{ type: 'jsonschema', url: `${EXT}schema.json` }] },
        { id: EXT_SUB, version: '2.0', schemas: [{ type: 'jsonschema', url: `${EXT_SUB}s.json` }] }
      ],
      type: 'collection',
      id: ROOT_ID,
      name: 'root',
      traits: [{ type: 'scene', coordinate_systems: [], coordinate_transformations: [] }],
      nodes: [
        {
          type: 'multiscale',
          id: RAW_ID,
          name: 'raw-entry',
          path: { type: 'zarr', format: 'relative', href: './raw' },
          traits: [
            { type: 'labels', label_attributes: [{ label_value: 1, rgba: [0, 0, 255, 255] }] },
            { type: 'well', row_index: 0, column_index: 0 }
          ]
        },
        {
          type: 'collection',
          id: LABELS_COLL_ID,
          path: { type: 'json', format: 'relative', href: './labels.json' }
        },
        {
          type: `${EXT}table`,
          id: TABLE_ID,
          name: 'regionprops',
          path: { type: `${EXT}csv`, format: 'relative', href: './regionprops.csv' },
          columns: ['label', 'area']
        }
      ]
    }
  }
};

const rawDoc = multiscaleDoc(RAW_ID, 'raw-doc', [
  { type: 'labels', label_attributes: [{ label_value: 1, rgba: [0, 255, 0, 255] }] },
  { type: `${EXT}provenance`, task: 'segmentation' }
]);

const labelsJsonDoc = {
  ome: {
    version: '0.x',
    type: 'collection',
    id: LABELS_COLL_ID,
    name: 'labels',
    nodes: [
      {
        type: 'multiscale',
        id: NUCLEI_ID,
        path: { type: 'zarr', format: 'relative', href: './nuclei' }
      }
    ]
  }
};

const documents: Record<string, unknown> = {
  [ROOT_URL]: rootDoc,
  'https://example.com/coll/raw/zarr.json': rawDoc,
  'https://example.com/coll/labels.json': labelsJsonDoc,
  'https://example.com/coll/nuclei/zarr.json': multiscaleDoc(NUCLEI_ID, 'nuclei')
};

function mockFetch(docs: Record<string, unknown>) {
  global.fetch = vi.fn(async (url: string) =>
    url in docs ? { ok: true, json: async () => docs[url] } : { ok: false, status: 404 }
  ) as any;
}

function fetchedUrls(): string[] {
  return (global.fetch as any).mock.calls.map((call: unknown[]) => call[0]);
}

async function loadedGraph(docs = documents, autoloadDepth = 0) {
  mockFetch(docs);
  const graph = new NGFFGraph(new NGFFLoader(ROOT_URL), autoloadDepth);
  const errors: Array<string | null> = [];
  graph.onError((message) => errors.push(message));
  expect(await graph.loadRoot()).toBe(true);
  return { graph, errors };
}

function byOmeId(graph: NGFFGraph, id: string): D3Node {
  const node = graph.findNodeByOmeId(id);
  expect(node).toBeDefined();
  return node!;
}

describe('NGFFGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the root and its declared children', async () => {
    const { graph } = await loadedGraph();
    const nodes = graph.getNodes();
    expect(nodes).toHaveLength(4);

    const root = byOmeId(graph, ROOT_ID);
    expect(root.parentId).toBeNull();
    expect(root.loaded).toBe(true);
    expect(root.documentUrl).toBe(ROOT_URL);
    expect(root.targetUrl).toBeUndefined();
    expect(root.manifest).toHaveLength(2);
    expect(root.omeNode.nodes).toBeUndefined();
    expect(root.omeNode.version).toBeUndefined();
    expect(root.omeNode.extension_manifest).toBeUndefined();

    const raw = byOmeId(graph, RAW_ID);
    expect(raw.parentId).toBe(root.id);
    expect(raw.loaded).toBe(false);
    expect(raw.documentUrl).toBe(ROOT_URL);
    expect(raw.targetUrl).toBe('https://example.com/coll/raw/zarr.json');

    const labels = byOmeId(graph, LABELS_COLL_ID);
    expect(labels.targetUrl).toBe('https://example.com/coll/labels.json');

    // extension path type: data, not a document -> nothing to load
    const table = byOmeId(graph, TABLE_ID);
    expect(table.loaded).toBe(true);
    expect(table.targetUrl).toBeUndefined();
    expect(table.omeNode.columns).toEqual(['label', 'area']);

    expect(graph.getHierarchy().leaves()).toHaveLength(3);
    expect(graph.countUnloadedNodes('multiscale')).toBe(1);
    expect(graph.countUnloadedNodes('collection')).toBe(1);
  });

  it('loads a multiscale document: fields copied, traits merged, no children', async () => {
    const { graph } = await loadedGraph();
    const raw = byOmeId(graph, RAW_ID);
    await graph.loadNode(raw);

    expect(raw.loaded).toBe(true);
    expect(raw.error).toBe(false);
    expect(raw.omeNode.scales).toHaveLength(1);
    expect(raw.omeNode.coordinate_systems).toHaveLength(1);
    expect(raw.omeNode.nodes).toBeUndefined();
    expect(graph.getChildren(raw)).toHaveLength(0);
    // the declaring entry keeps its path, type and id
    expect(raw.omeNode.path).toEqual({ type: 'zarr', format: 'relative', href: './raw' });
    expect(raw.omeNode.type).toBe('multiscale');
    // the entry name wins over the document name
    expect(raw.omeNode.name).toBe('raw-entry');
    // the document manifest is attached to the node (none here)
    expect(raw.manifest).toBeUndefined();
    // traits: document order, entry wins per type, entry-only traits appended
    expect(raw.omeNode.traits).toEqual([
      { type: 'labels', label_attributes: [{ label_value: 1, rgba: [0, 0, 255, 255] }] },
      { type: `${EXT}provenance`, task: 'segmentation' },
      { type: 'well', row_index: 0, column_index: 0 }
    ]);
  });

  it('falls back to the document name when the entry has none', async () => {
    const { graph } = await loadedGraph();
    const labels = byOmeId(graph, LABELS_COLL_ID);
    await graph.loadNode(labels);
    expect(labels.omeNode.name).toBe('labels');
    const nuclei = byOmeId(graph, NUCLEI_ID);
    await graph.loadNode(nuclei);
    expect(nuclei.omeNode.name).toBe('nuclei');
  });

  it('appends the children of a json document, resolved against the json file', async () => {
    const { graph } = await loadedGraph();
    const labels = byOmeId(graph, LABELS_COLL_ID);
    await graph.loadNode(labels);

    const children = graph.getChildren(labels);
    expect(children).toHaveLength(1);
    const nuclei = children[0];
    expect(nuclei.omeNode.id).toBe(NUCLEI_ID);
    expect(nuclei.documentUrl).toBe('https://example.com/coll/labels.json');
    expect(nuclei.targetUrl).toBe('https://example.com/coll/nuclei/zarr.json');
    expect(graph.getParentsIds(nuclei)).toEqual([ROOT_ID, LABELS_COLL_ID, NUCLEI_ID]);
  });

  it('recursiveLoad fetches every document but never data paths', async () => {
    const { graph } = await loadedGraph();
    await graph.recursiveLoad(Infinity);
    expect(graph.getNodes().every((n) => n.loaded)).toBe(true);
    const urls = fetchedUrls();
    expect(urls).toContain('https://example.com/coll/raw/zarr.json');
    expect(urls).toContain('https://example.com/coll/labels.json');
    expect(urls).toContain('https://example.com/coll/nuclei/zarr.json');
    expect(urls.some((url) => url.endsWith('.csv'))).toBe(false);
    expect(graph.countUnloadedNodes('multiscale')).toBe(0);
  });

  it('autoloadDepth loads one level at a time', async () => {
    const { graph } = await loadedGraph(documents, 1);
    expect(byOmeId(graph, RAW_ID).loaded).toBe(true);
    expect(byOmeId(graph, LABELS_COLL_ID).loaded).toBe(true);
    expect(byOmeId(graph, NUCLEI_ID).loaded).toBe(false);
  });

  it('loadNodeAtPath follows a path of RFC-8 ids', async () => {
    const { graph } = await loadedGraph();
    const node = await graph.loadNodeAtPath(`${ROOT_ID}/${LABELS_COLL_ID}/${NUCLEI_ID}`);
    expect(node.omeNode.id).toBe(NUCLEI_ID);
    expect(node.loaded).toBe(true);
    await expect(graph.loadNodeAtPath(`${ROOT_ID}/nope`)).rejects.toThrow(
      `Node at path "${ROOT_ID}" had no child with ID "nope"`
    );
  });

  it('reports an id mismatch between entry and document', async () => {
    const { graph, errors } = await loadedGraph({
      ...documents,
      'https://example.com/coll/raw/zarr.json': multiscaleDoc(NUCLEI_ID, 'other')
    });
    const raw = byOmeId(graph, RAW_ID);
    await graph.loadNode(raw);
    expect(raw.loaded).toBe(false);
    expect(raw.error).toBe(true);
    expect(errors.at(-1)).toMatch(
      /Id mismatch: node ".*0002" resolves to a document whose root id is ".*0004"/
    );
  });

  it('reports a type mismatch between entry and document', async () => {
    const { graph, errors } = await loadedGraph({
      ...documents,
      'https://example.com/coll/labels.json': {
        ome: { ...multiscaleDoc(LABELS_COLL_ID, 'x').attributes.ome }
      }
    });
    const labels = byOmeId(graph, LABELS_COLL_ID);
    await graph.loadNode(labels);
    expect(labels.error).toBe(true);
    expect(errors.at(-1)).toMatch(/Type mismatch.*"collection".*"multiscale"/);
  });

  it('detects cycles through enclosing documents', async () => {
    const { graph, errors } = await loadedGraph({
      ...documents,
      'https://example.com/coll/labels.json': {
        ome: {
          version: '0.x',
          type: 'collection',
          id: LABELS_COLL_ID,
          nodes: [
            {
              type: 'collection',
              id: ROOT_ID,
              path: { type: 'zarr', format: 'relative', href: './' }
            }
          ]
        }
      }
    });
    const labels = byOmeId(graph, LABELS_COLL_ID);
    await graph.loadNode(labels);
    const back = graph.getChildren(labels)[0];
    expect(back.targetUrl).toBe(ROOT_URL);
    await graph.loadNode(back);
    expect(back.error).toBe(true);
    expect(errors.at(-1)).toMatch(/Cycle detected/);
    // the root document was fetched only once
    expect(fetchedUrls().filter((url) => url === ROOT_URL)).toHaveLength(1);
  });

  it('two nodes pointing at the same document are a legal DAG', async () => {
    const twice = JSON.parse(JSON.stringify(rootDoc));
    twice.attributes.ome.nodes.push({
      type: 'multiscale',
      id: RAW_ID,
      name: 'raw-again',
      path: { type: 'zarr', format: 'relative', href: './raw' }
    });
    const { graph } = await loadedGraph({ ...documents, [ROOT_URL]: twice });
    await graph.recursiveLoad(Infinity);
    const raws = graph.getNodes().filter((n) => n.omeNode.id === RAW_ID);
    expect(raws).toHaveLength(2);
    expect(raws.every((n) => n.loaded && !n.error)).toBe(true);
  });

  it('marks nodes with unresolvable paths as errors without failing the document', async () => {
    const bad = JSON.parse(JSON.stringify(rootDoc));
    bad.attributes.ome.nodes[0].path = { type: 'zarr', format: 'http', href: './raw' };
    const { graph, errors } = await loadedGraph({ ...documents, [ROOT_URL]: bad });
    const raw = byOmeId(graph, RAW_ID);
    expect(raw.error).toBe(true);
    expect(raw.loaded).toBe(false);
    expect(errors.at(-1)).toMatch(/Unable to resolve the path of node "raw-entry"/);
    await graph.loadNode(raw);
    expect(fetchedUrls()).toEqual([ROOT_URL]);
  });

  it('fails loadRoot on a pre-revision document', async () => {
    mockFetch({
      [ROOT_URL]: {
        ome: {
          version: '0.x',
          type: 'collection',
          id: ROOT_ID,
          name: 'old',
          attributes: {},
          nodes: []
        }
      }
    });
    const graph = new NGFFGraph(new NGFFLoader(ROOT_URL), 0);
    const errors: Array<string | null> = [];
    graph.onError((message) => errors.push(message));
    expect(await graph.loadRoot()).toBe(false);
    expect(errors.at(-1)).toMatch(/pre-revision RFC-8 format/);
  });

  it('findManifestEntry picks the longest matching extension id', async () => {
    const { graph } = await loadedGraph();
    expect(graph.findManifestEntry(`${EXT}table`)?.id).toBe(EXT);
    expect(graph.findManifestEntry(`${EXT_SUB}thing`)?.id).toBe(EXT_SUB);
    expect(graph.findManifestEntry('https://other.org/x')).toBeUndefined();
  });

  it('computes extra edges from all nodes whenever the hierarchy is rebuilt', async () => {
    mockFetch(documents);
    const extraEdges = vi.fn((nodes: readonly D3Node[]) => {
      const root = nodes.find((n) => n.omeNode.id === ROOT_ID);
      const table = nodes.find((n) => n.omeNode.id === TABLE_ID);
      return root && table ? [{ sourceId: table.id, targetId: root.id }] : [];
    });
    const graph = new NGFFGraph(new NGFFLoader(ROOT_URL), 0, extraEdges);
    await graph.loadRoot();
    expect(graph.getExtraEdges()).toHaveLength(1);
    const callsAfterRoot = extraEdges.mock.calls.length;
    await graph.loadNode(byOmeId(graph, LABELS_COLL_ID));
    expect(extraEdges.mock.calls.length).toBeGreaterThan(callsAfterRoot);
    expect(extraEdges.mock.lastCall![0]).toHaveLength(5);
  });
});
