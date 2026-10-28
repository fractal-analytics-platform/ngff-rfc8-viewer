import type { D3Node, ExtraEdge, LabelsTrait } from './types';
import { getTrait } from './nodes';

/**
 * Extra graph edges from label images to the images they annotate: one edge per `source`
 * reference of a `labels` trait whose target is a node already in the graph.
 */
export function labelsSourceEdges(nodes: readonly D3Node[]): ExtraEdge[] {
  const edges: ExtraEdge[] = [];
  for (const node of nodes) {
    const labels = getTrait<LabelsTrait>(node.omeNode, 'labels');
    for (const ref of labels?.source ?? []) {
      const target = nodes.find((n) => n.omeNode.id === ref.ref);
      if (target && target.id !== node.id) {
        edges.push({ sourceId: node.id, targetId: target.id });
      }
    }
  }
  return edges;
}
