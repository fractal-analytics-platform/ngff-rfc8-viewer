import * as d3 from 'd3';
import type { D3Node, ExtraEdgesFn, OmeNode, OmePath } from './types';
import type { NGFFSidebar } from './sidebar';
import { CSS_CLASS_PREFIX } from './constants';
import type { NGFFLoader } from './loader';

const colors: Record<string, string> = {
  collection: '#4f81bd',
  multiscale: '#9bbb59',
  singlescale: '#c0504d'
};

const defaultNodeColor = '#999';
const selectionStrokeColor = '#333';
const inliningStrokeColor = '#8e009b';

const nodeSpacing = 160;
const circleRadius = 24;
const arrowSize = 20;

export class NGFFGraph {
  private elementId: string;
  private loader: NGFFLoader;
  private sidebar: NGFFSidebar;
  private computeExtraEdges: ExtraEdgesFn | undefined;

  private nodes: Array<D3Node> = [];
  private extraEdges: Array<{ sourceId: string; targetId: string }> = [];

  private width: number = 0;
  private height: number = 0;
  private currentZoom: any;
  /** x position of root node */
  private rootX: number | null = null;

  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any> | undefined;
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | undefined;
  private errorAlert: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | undefined;

  constructor(
    elementId: string,
    loader: NGFFLoader,
    sidebar: NGFFSidebar,
    computeExtraEdges: ExtraEdgesFn | undefined = undefined
  ) {
    this.elementId = elementId;
    this.loader = loader;
    this.sidebar = sidebar;
    this.computeExtraEdges = computeExtraEdges;
  }

  async loadRoot() {
    const data = await this.loader.loadGraphData();
    this.render(data);
  }

  walk(
    nodes: Array<D3Node>,
    node: OmeNode,
    parentId: string | null,
    extraEdges: Array<{ sourceId: string; targetId: string }>
  ) {
    nodes.push({
      id: node.id ?? node.name,
      name: node.name,
      type: node.type,
      attributes: node.attributes,
      path: 'path' in node ? node.path : undefined,
      parentId: parentId,
      loading: false,
      expanded: !('path' in node)
    });

    if (this.computeExtraEdges) {
      this.computeExtraEdges(node, extraEdges);
    }

    if ('nodes' in node && node.nodes) {
      node.nodes.forEach((child) => this.walk(nodes, child, node.id, extraEdges));
    }
  }

  treeStats(node: OmeNode): { leaves: number; depth: number } {
    if (!node) {
      return { leaves: 0, depth: 0 };
    }

    const children = 'nodes' in node ? node.nodes || [] : [];

    if (children.length === 0) {
      return { leaves: 1, depth: 0 };
    }

    let leaves = 0;
    let depth = 0;

    for (const child of children) {
      const stats = this.treeStats(child);

      leaves += stats.leaves;
      depth = Math.max(depth, stats.depth + 1);
    }

    return { leaves, depth };
  }

  render(data: any) {
    const ome = data.ome;

    const { leaves, depth } = this.treeStats(ome);
    this.width = Math.max(800, leaves * nodeSpacing);
    this.height = Math.max(1, depth) * nodeSpacing;

    this.svg = d3
      .select(`#${this.elementId}`)
      .append('svg')
      .attr('id', `${this.elementId}-graph`)
      .attr('class', `${CSS_CLASS_PREFIX}graph`)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('touch-action', 'none')
      .on('click', (event) => {
        if (!(event.target instanceof SVGCircleElement)) {
          this.sidebar.hide();
        }
      });

    this.tooltip = d3
      .select('body')
      .append('div')
      .attr('class', `${CSS_CLASS_PREFIX}tree-tooltip`)
      .style('opacity', 0);

    this.errorAlert = d3
      .select('body')
      .append('div')
      .attr(
        'class',
        `${CSS_CLASS_PREFIX}alert ${CSS_CLASS_PREFIX}error ${CSS_CLASS_PREFIX}alert-fixed`
      )
      .style('opacity', 0);

    this.walk(this.nodes, ome, null, this.extraEdges);
    this.renderTree();
  }

  renderTree() {
    const hierarchy = d3.stratify()(this.nodes);
    const treeLayout = d3
      .tree()
      .size([this.width, this.height])
      .separation(() => nodeSpacing);
    treeLayout(hierarchy);

    const descendants = hierarchy.descendants();

    this.svg!.selectAll('*').remove();
    this.tooltip!.style('opacity', 0);

    const zoomLayer = this.svg!.append('g');
    const tree = zoomLayer.append('g');

    const minZoom = 0.1;
    const maxZoom = Math.max(2, this.width / nodeSpacing / 5);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .on('zoom', (event) => {
        this.currentZoom = event.transform;
        zoomLayer.attr('transform', event.transform);
      });
    this.svg!.call(zoom);

    this.svg!.append('defs')
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
      .attr('stroke', (d) => colors[(d.source.data as OmeNode).type] || defaultNodeColor)
      .attr('fill', (d) => colors[(d.source.data as OmeNode).type] || defaultNodeColor)
      .attr('marker-end', 'url(#arrow)');

    // Build a fast lookup map of computed coordinates
    const nodeMap = new Map();
    descendants.forEach((d) => nodeMap.set((d.data as OmeNode).id, d));

    const resolvedExtraEdges = this.extraEdges.map((link) => ({
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

    tree
      .selectAll('circle')
      .data(descendants)
      .enter()
      .append('circle')
      .attr('cx', (d) => Number(d.x))
      .attr('cy', (d) => Number(d.y))
      .attr('r', circleRadius)
      .attr('fill', (d) => colors[(d.data as D3Node).type] || defaultNodeColor)
      .style('cursor', 'pointer')
      .attr('stroke', (d) => ((d.data as D3Node).expanded ? 'none' : inliningStrokeColor))
      .attr('stroke-dasharray', (d) => ((d.data as D3Node).expanded ? 'none' : '10,5'))
      .attr('stroke-width', 2)
      .on('click', async (event, d) => {
        const node = d.data as D3Node;
        this.sidebar.showInfo(node);
        if (node.path) {
          if (event.target instanceof SVGCircleElement) {
            event.target.classList.add('ngff-rfc8-viewer-rotating-dash');
          }
          await this.loadNode(node as D3Node & { path: OmePath });
          if (event.target instanceof SVGCircleElement) {
            event.target.classList.remove('ngff-rfc8-viewer-rotating-dash');
          }
        }
      })
      .on('mouseenter', (event, d) => {
        if (event.target instanceof SVGCircleElement) {
          d3.select(event.target).attr('stroke', selectionStrokeColor);
          const data = d.data as D3Node;
          this.tooltip?.style('opacity', 1).html(`
            <strong>Id: </strong>${data.id}<br>
            <strong>Name: </strong>${data.name}<br>
            <strong>Type: </strong> ${data.type}
          `);
        }
      })
      .on('mousemove', (event) => {
        this.tooltip?.style('left', `${event.pageX + 12}px`).style('top', `${event.pageY + 12}px`);
      })
      .on('mouseleave', (event, d) => {
        if (event.target instanceof SVGCircleElement) {
          d3.select(event.target).attr(
            'stroke',
            (d.data as D3Node).expanded ? 'none' : inliningStrokeColor
          );
          this.tooltip?.style('opacity', 0);
        }
      });

    tree
      .select('circle') // select the root node
      .each((d: any) => {
        if (this.rootX !== null && this.currentZoom) {
          // recompute transform x position based on previous root position - necessary to prevent shift on node expansion
          this.currentZoom.x = this.currentZoom.x - (d.x - this.rootX) * this.currentZoom.k;
        }
        this.rootX = d.x;
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
      .text((d) => (d.data as D3Node).name);

    // Compute initial zoom level
    if (!this.currentZoom) {
      const k = Math.max(minZoom, maxZoom / 3);
      this.currentZoom = d3.zoomIdentity
        .translate(this.width / 2, this.height / 2)
        .scale(k)
        .translate(-this.width / 2, -this.height / 2);
    }

    this.svg!.call(zoom.transform, this.currentZoom);
  }

  async loadNode(node: D3Node & { path: OmePath }) {
    if (node.loading || node.expanded) {
      return;
    }
    this.errorAlert?.style('opacity', 0);
    node.loading = true;
    try {
      switch (node.path.type) {
        case 'json':
          {
            const { ome } = await this.loader.loadNode(node.path.path);
            node.expanded = true;
            await this.appendSubtree(ome);
          }
          break;
        case 'zarr':
          {
            const { ome } = await this.loader.loadNode(`${node.path.path}/zarr.json`);
            node.expanded = true;
            await this.appendSubtree(ome);
          }
          break;
        default:
          this.showNodeLoadingError(`Unexpected path type: ${node.path.type}`);
          break;
      }
    } catch (err) {
      this.showNodeLoadingError(err instanceof Error ? err.message : 'Unexpected error');
    }
    node.loading = false;
  }

  async appendSubtree(ome: OmeNode) {
    const nodes: Array<D3Node> = [];
    const extraEdges: Array<{ sourceId: string; targetId: string }> = [];
    const { leaves, depth } = this.treeStats(ome);
    this.width = Math.max(this.width, leaves * nodeSpacing);
    this.height = Math.max(1, depth) * nodeSpacing + this.height;
    this.walk(nodes, ome, null, extraEdges);
    // push everything except the subtree root
    this.nodes.push(...nodes.splice(1));
    this.renderTree();
  }

  showNodeLoadingError(message: string) {
    if (!this.errorAlert) {
      return;
    }
    this.errorAlert.selectAll('*').remove();
    this.errorAlert.append('span').text(message);
    this.errorAlert
      .append('button')
      .html('&times;')
      .on('click', () => {
        this.errorAlert?.style('opacity', 0);
      });
    this.errorAlert.style('opacity', 1);
  }
}
