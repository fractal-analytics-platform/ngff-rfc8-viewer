import * as d3 from 'd3';
import type { D3Node, OmeNode, OmePath } from './../types';
import { CSS_CLASS_PREFIX } from './../constants';
import type { NGFFGraph } from './../graph';

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

export class SVGGraph {
  private graph: NGFFGraph;
  private width: number = 0;
  private height: number = 0;
  private currentZoom: any;
  /** x position of root node */
  private rootX: number | null = null;

  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private errorAlert: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

  private nodeSelectHandler: (node: D3Node) => void = () => {};
  private backgroundClickHandler: () => void = () => {};

  constructor(graph: NGFFGraph, containerId: string) {
    this.graph = graph;

    this.errorAlert = d3
      .select('body')
      .append('div')
      .attr(
        'class',
        `${CSS_CLASS_PREFIX}alert ${CSS_CLASS_PREFIX}error ${CSS_CLASS_PREFIX}alert-fixed ${CSS_CLASS_PREFIX}hide`
      );

    this.svg = d3
      .select(`#${containerId}`)
      .append('svg')
      .attr('id', `${containerId}-graph`)
      .attr('class', `${CSS_CLASS_PREFIX}graph`)
      .attr('width', '100%')
      .attr('height', '100%')
      .style('touch-action', 'none')
      .on('click', (event) => {
        if (!(event.target instanceof SVGCircleElement)) {
          this.backgroundClickHandler();
        }
      });

    this.tooltip = d3
      .select('body')
      .append('div')
      .attr('class', `${CSS_CLASS_PREFIX}tree-tooltip`)
      .style('opacity', 0);

    graph.onChange(() => this.renderTree());
    graph.onError((message) =>
      message === null ? this.hideErrorAlert() : this.showErrorAlert(message)
    );
  }

  onNodeSelect(fn: (node: D3Node) => void) {
    this.nodeSelectHandler = fn;
  }

  onBackgroundClick(fn: () => void) {
    this.backgroundClickHandler = fn;
  }

  renderTree() {
    const hierarchy = this.graph.getHierarchy();
    this.width = Math.max(800, hierarchy.leaves().length * nodeSpacing);
    this.height = Math.max(1, hierarchy.height) * nodeSpacing;
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

    const treeLayout = d3
      .tree<D3Node>()
      .size([this.width, this.height])
      .separation(() => nodeSpacing);
    treeLayout(this.graph.getHierarchy());

    const descendants = this.graph.getHierarchy().descendants();

    this.svg.selectAll('*').remove();
    this.tooltip.style('opacity', 0);

    const zoomLayer = this.svg.append('g');
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
    this.svg.call(zoom);

    this.svg
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
      .data(this.graph.getHierarchy().links())
      .enter()
      .append('line')
      .attr('x1', (d) => Number(d.source.x))
      .attr('y1', (d) => Number(d.source.y))
      .attr('x2', (d) => Number(d.target.x))
      .attr('y2', (d) => Number(d.target.y))
      .attr('stroke', (d) => colors[d.source.data.omeNode.type] || defaultNodeColor)
      .attr('fill', (d) => colors[d.source.data.omeNode.type] || defaultNodeColor)
      .attr('marker-end', 'url(#arrow)');

    // Build a fast lookup map of computed coordinates
    const nodeMap = new Map();
    descendants.forEach((d) => nodeMap.set(d.data.id, d));

    const resolvedExtraEdges = this.graph.getExtraEdges().map((link) => ({
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
      .attr('fill', (d) => colors[d.data.omeNode.type] || defaultNodeColor)
      .style('cursor', 'pointer')
      .attr('stroke', (d) => (d.data.loaded ? 'none' : inliningStrokeColor))
      .attr('stroke-dasharray', (d) => (d.data.loaded ? 'none' : '10,5'))
      .attr('stroke-width', 2)
      .on('click', async (event, d) => {
        const node = d.data;
        this.nodeSelectHandler(node);
        if ('path' in node.omeNode && node.omeNode.path) {
          if (event.target instanceof SVGCircleElement) {
            event.target.classList.add('ngff-rfc8-viewer-rotating-dash');
          }
          await this.graph.loadNodeWithSignal(
            node as D3Node & { omeNode: OmeNode & { path: OmePath } }
          );
          this.renderTree();
          if (event.target instanceof SVGCircleElement) {
            event.target.classList.remove('ngff-rfc8-viewer-rotating-dash');
          }
        }
      })
      .on('mouseenter', (event, d) => {
        if (event.target instanceof SVGCircleElement) {
          d3.select(event.target).attr('stroke', selectionStrokeColor);
          this.tooltip?.style('opacity', 1).html(`
            <strong>Id: </strong>${d.data.omeNode.id || '-'}<br>
            <strong>Name: </strong>${d.data.omeNode.name}<br>
            <strong>Type: </strong> ${d.data.omeNode.type}
          `);
        }
      })
      .on('mousemove', (event) => {
        this.tooltip?.style('left', `${event.pageX + 12}px`).style('top', `${event.pageY + 12}px`);
      })
      .on('mouseleave', (event, d) => {
        if (event.target instanceof SVGCircleElement) {
          d3.select(event.target).attr('stroke', d.data.loaded ? 'none' : inliningStrokeColor);
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
      .each(function (d) {
        // split long labels on multiple lines
        const charsPerLine = 15;
        const name = d.data.omeNode.name;

        for (let i = 0; i < name.length; i += charsPerLine) {
          const line = name.substring(i, i + charsPerLine);
          const lineNumber = Math.floor(i / charsPerLine);

          d3.select(this)
            .append('tspan')
            .attr('x', Number(d.x))
            .attr('dy', lineNumber === 0 ? 0 : '1.2em')
            .text(line);
        }
      });

    // Compute initial zoom level
    if (!this.currentZoom) {
      const k = Math.max(minZoom, maxZoom / 3);
      this.currentZoom = d3.zoomIdentity
        .translate(this.width / 2, this.height / 2)
        .scale(k)
        .translate(-this.width / 2, -this.height / 2);
    }

    this.svg.call(zoom.transform, this.currentZoom);
  }

  showErrorAlert(message: string) {
    this.errorAlert.selectAll('*').remove();
    this.errorAlert.append('span').text(message);
    this.errorAlert
      .append('button')
      .html('&times;')
      .on('click', () => this.hideErrorAlert());
    this.errorAlert.classed(`${CSS_CLASS_PREFIX}hide`, false);
  }

  hideErrorAlert() {
    this.errorAlert.classed(`${CSS_CLASS_PREFIX}hide`, true);
  }
}
