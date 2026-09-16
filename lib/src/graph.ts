import * as d3 from 'd3';
import type { BaseOmeNode, D3Node } from './types';

const colors: Record<string, string> = {
  collection: '#4f81bd',
  multiscale: '#9bbb59',
  singlescale: '#c0504d'
};

const defaultColor = '#999';

function toD3(
  tree: BaseOmeNode,
  computeExtraEdges:
    | ((node: BaseOmeNode, extraEdges: Array<{ sourceId: string; targetId: string }>) => void)
    | undefined
) {
  const nodes: Array<D3Node> = [];
  const extraEdges: Array<{ sourceId: string; targetId: string }> = [];

  function walk(
    node: BaseOmeNode,
    parentId: string | null,
    extraEdges: Array<{ sourceId: string; targetId: string }>
  ) {
    nodes.push({
      id: node.id ?? node.name,
      name: node.name,
      type: node.type,
      attributes: node.attributes,
      parentId: parentId
    });

    if (computeExtraEdges) {
      computeExtraEdges(node, extraEdges);
    }

    node.nodes?.forEach((child) => walk(child, node.id, extraEdges));
  }

  walk(tree, null, extraEdges);
  return { nodes, extraEdges };
}

function treeStats(node: D3Node): { leaves: number; depth: number } {
  if (!node) {
    return { leaves: 0, depth: 0 };
  }

  const children = node.nodes ?? [];

  if (children.length === 0) {
    return { leaves: 1, depth: 0 };
  }

  let leaves = 0;
  let depth = 0;

  for (const child of children) {
    const stats = treeStats(child);

    leaves += stats.leaves;
    depth = Math.max(depth, stats.depth + 1);
  }

  return { leaves, depth };
}

export function buildNetworkGraph(
  data: any,
  elementId: string,
  computeExtraEdges:
    | ((node: BaseOmeNode, extraEdges: Array<{ sourceId: string; targetId: string }>) => void)
    | undefined = undefined
) {
  const ome = data.ome;

  const { nodes, extraEdges } = toD3(ome, computeExtraEdges);

  const { leaves, depth } = treeStats(ome);
  const nodeSpacing = 160;
  const width = Math.max(800, leaves * nodeSpacing);
  const height = Math.max(1, depth) * nodeSpacing;

  const circleRadius = 24;
  const arrowSize = 20;

  let hierarchy = d3.stratify()(nodes);
  const treeLayout = d3
    .tree()
    .size([width, height])
    .separation(() => nodeSpacing);
  hierarchy = treeLayout(hierarchy);

  const descendants = hierarchy.descendants();

  const svg = d3
    .select(`#${elementId}`)
    .append('svg')
    .attr('id', `${elementId}-graph`)
    .attr('class', 'ngff-rfc8-viewer-graph')
    .attr('width', '100%')
    .attr('height', '800px')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('touch-action', 'none');

  svg.selectAll('*').remove();

  const zoomLayer = svg.append('g');
  const tree = zoomLayer.append('g');

  const minZoom = 0.5;
  const maxZoom = Math.max(2, width / nodeSpacing / 5);

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([minZoom, maxZoom])
    .on('zoom', (event) => zoomLayer.attr('transform', event.transform));
  svg.call(zoom);

  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', `0 0 ${arrowSize} ${arrowSize}`)
    .attr('refX', arrowSize + circleRadius)
    .attr('refY', arrowSize / 2)
    .attr('markerWidth', arrowSize)
    .attr('markerHeight', arrowSize)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', `M 0 0 L ${arrowSize} ${arrowSize / 2} L 0 ${arrowSize} z`)
    .attr('fill', 'context-fill');

  tree
    .selectAll('line.main')
    .data(hierarchy.links())
    .enter()
    .append('line')
    .attr('x1', (d) => Number(d.source.x))
    .attr('y1', (d) => Number(d.source.y))
    .attr('x2', (d) => Number(d.target.x))
    .attr('y2', (d) => Number(d.target.y))
    .attr('stroke', (d) => colors[(d.source.data as BaseOmeNode).type] || defaultColor)
    .attr('fill', (d) => colors[(d.source.data as BaseOmeNode).type] || defaultColor)
    .attr('marker-end', 'url(#arrow)');

  // Build a fast lookup map of computed coordinates
  const nodeMap = new Map();
  descendants.forEach((d) => nodeMap.set((d.data as BaseOmeNode).id, d));

  const resolvedExtraEdges = extraEdges.map((link) => ({
    source: nodeMap.get(link.sourceId),
    target: nodeMap.get(link.targetId)
  }));

  tree
    .selectAll('line.source')
    .data(resolvedExtraEdges)
    .enter()
    .append('line')
    .attr('x1', (d) => Number(d.source.x))
    .attr('y1', (d) => Number(d.source.y))
    .attr('x2', (d) => Number(d.target.x))
    .attr('y2', (d) => Number(d.target.y))
    .attr('fill', '#e1b12c')
    .attr('stroke', '#e1b12c')
    .attr('stroke-dasharray', `${arrowSize / 3}, ${arrowSize / 3}`)
    .attr('marker-end', 'url(#arrow)');

  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'ngff-rfc8-viewer-tree-tooltip')
    .style('opacity', 0);

  tree
    .selectAll('circle')
    .data(descendants)
    .enter()
    .append('circle')
    .attr('cx', (d) => Number(d.x))
    .attr('cy', (d) => Number(d.y))
    .attr('r', circleRadius)
    .attr('fill', (d) => colors[(d.data as BaseOmeNode).type] || defaultColor)
    .on('mouseenter', function (_, d) {
      const data = d.data as BaseOmeNode;
      tooltip.style('opacity', 1).html(`<strong>${data.name}</strong><br>
        Type: ${data.type}<br>
        Attributes: ${JSON.stringify(data.attributes)}
      `);
    })
    .on('mousemove', function (event) {
      tooltip.style('left', `${event.pageX + 12}px`).style('top', `${event.pageY + 12}px`);
    })
    .on('mouseleave', function () {
      tooltip.style('opacity', 0);
    });

  tree
    .selectAll('text.node-label')
    .data(descendants)
    .enter()
    .append('text')
    .attr('class', 'node-label')
    .attr('x', (d) => Number(d.x))
    .attr('y', (d) => Number(d.y) + 2 * circleRadius + 5)
    .attr('text-anchor', 'middle')
    .text((d) => (d.data as BaseOmeNode).name);

  // Initial zoom level
  const k = Math.max(minZoom, maxZoom / 3);
  const startX = descendants[0].x || 0;
  const initialTransform = d3.zoomIdentity
    .translate(width / 2 - startX * k, (-height / 2) * k)
    .scale(k);
  svg.call(zoom.transform, initialTransform);
}
