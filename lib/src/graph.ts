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
  private autoloadDepth: number;
  private computeExtraEdges: ExtraEdgesFn | undefined;

  private nodes: Array<D3Node> = [];
  private extraEdges: Array<{ sourceId: string; targetId: string }> = [];

  private hierarchy: d3.HierarchyNode<D3Node> | undefined;
  private width: number = 0;
  private height: number = 0;
  private currentZoom: any;
  /** x position of root node */
  private rootX: number | null = null;

  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any> | undefined;
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | undefined;
  private errorAlert: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | undefined;

  private signalLoading: (loading: boolean) => void = () => {};

  constructor(
    elementId: string,
    loader: NGFFLoader,
    sidebar: NGFFSidebar,
    autoloadDepth: number,
    computeExtraEdges: ExtraEdgesFn | undefined = undefined
  ) {
    this.elementId = elementId;
    this.loader = loader;
    this.sidebar = sidebar;
    this.autoloadDepth = autoloadDepth;
    this.computeExtraEdges = computeExtraEdges;
  }

  onLoading(fn: (loading: boolean) => void) {
    this.signalLoading = fn;
  }

  async loadRoot() {
    const data = await this.loader.loadGraphData();
    await this.render(data);
  }

  walk(
    nodes: Array<D3Node>,
    node: OmeNode,
    parentId: string | null,
    resolvedPath: string,
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
      expanded: !('path' in node),
      resolvedPath,
      error: false
    });

    if (this.computeExtraEdges) {
      this.computeExtraEdges(node, extraEdges);
    }

    if ('nodes' in node && node.nodes) {
      node.nodes.forEach((child) => this.walk(nodes, child, node.id, resolvedPath, extraEdges));
    }
  }

  async render(data: any) {
    const ome = data.ome;

    this.walk(this.nodes, ome, null, './', this.extraEdges);
    this.buildHierarchy();

    this.errorAlert = d3
      .select('body')
      .append('div')
      .attr(
        'class',
        `${CSS_CLASS_PREFIX}alert ${CSS_CLASS_PREFIX}error ${CSS_CLASS_PREFIX}alert-fixed ${CSS_CLASS_PREFIX}hide`
      );

    if (this.autoloadDepth > 0) {
      this.signalLoading(true);
      await this.recusiveLoad(this.autoloadDepth);
      this.signalLoading(false);
    }

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

    this.renderTree();
  }

  async recusiveLoad(autoloadDepth: number) {
    if (autoloadDepth === Infinity || autoloadDepth > 0) {
      let loaded = false;
      for (const leave of this.hierarchy!.leaves()) {
        if ('path' in leave.data) {
          const node = leave.data as D3Node & { path: OmePath };
          if (!node.expanded && !node.error) {
            await this.loadNode(node);
            loaded = true;
          }
        }
      }
      if (loaded) {
        await this.recusiveLoad(autoloadDepth === Infinity ? Infinity : autoloadDepth - 1);
      }
    }
  }

  buildHierarchy() {
    this.hierarchy = d3.stratify<D3Node>()(this.nodes);
    this.width = Math.max(800, this.hierarchy.leaves().length * nodeSpacing);
    this.height = Math.max(1, this.hierarchy.height) * nodeSpacing;
  }

  renderTree() {
    const treeLayout = d3
      .tree<D3Node>()
      .size([this.width, this.height])
      .separation(() => nodeSpacing);
    treeLayout(this.hierarchy!);

    const descendants = this.hierarchy!.descendants();

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
      .data(this.hierarchy!.links())
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
          this.signalLoading(true);
          await this.loadNode(node as D3Node & { path: OmePath });
          this.signalLoading(false);
          this.renderTree();
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
    if (node.loading || node.expanded || node.error) {
      return;
    }
    this.hideErrorAlert();
    node.loading = true;
    try {
      switch (node.path.type) {
        case 'json':
          {
            const resolvedPath = this.resolvePath(node.resolvedPath, node.path.path);
            const { ome } = await this.loader.loadNode(resolvedPath);
            this.updateNode(node, ome);
            await this.appendSubtree(
              ome,
              resolvedPath.substring(0, resolvedPath.search(/\/[^/]+\.json$/))
            );
          }
          break;
        case 'zarr':
          {
            const { attributes } = await this.loader.loadNode(
              this.resolvePath(node.resolvedPath, `${node.path.path}/zarr.json`)
            );
            this.updateNode(node, attributes.ome);
            await this.appendSubtree(
              attributes.ome,
              this.resolvePath(node.resolvedPath, node.path.path)
            );
          }
          break;
        default:
          this.showNodeLoadingError(`Unexpected path type: ${node.path.type}`);
          break;
      }
    } catch (err) {
      node.expanded = false;
      node.error = true;
      console.error(err);
      this.showNodeLoadingError(err instanceof Error ? err.message : 'Unexpected error');
    }
    node.loading = false;
  }

  updateNode(node: D3Node, ome: OmeNode) {
    node.expanded = true;
    node.attributes = { ...(node.attributes || {}), ...ome.attributes };
    if (this.sidebar.isOpen()) {
      this.sidebar.showInfo(node);
    }
  }

  resolvePath(parentPath: string, path: string) {
    if (!path.startsWith('./') || path.includes('..')) {
      throw new Error(`Unsupported path "${path}"`);
    }
    parentPath = parentPath.replace(/^\.\//, '').replace(/\/$/, '');
    path = path.replace(/^\.\//, '').replace(/\/$/, '');
    return parentPath ? `./${parentPath}/${path}` : `./${path}`;
  }

  async appendSubtree(ome: OmeNode, resolvedPath: string) {
    const nodes: Array<D3Node> = [];
    const extraEdges: Array<{ sourceId: string; targetId: string }> = [];
    this.walk(nodes, ome, null, resolvedPath, extraEdges);
    if (nodes.length > 0) {
      this.nodes.push(...nodes.splice(1));
    }
    this.buildHierarchy();
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
      .on('click', () => this.hideErrorAlert());
    const classAttribute = this.errorAlert.attr('class');
    this.errorAlert.attr(
      'class',
      classAttribute
        .split(' ')
        .filter((c) => c !== `${CSS_CLASS_PREFIX}hide`)
        .join(' ')
    );
  }

  hideErrorAlert() {
    this.errorAlert!.attr('class', `${this.errorAlert!.attr('class')} ${CSS_CLASS_PREFIX}hide`);
  }
}
