import * as d3 from 'd3';
import type { D3Node, OmeNode, OmePath } from '../types';
import { CSS_CLASS_PREFIX, NODE_COLORS, STROKE_COLORS } from '../constants';
import type { NGFFGraph } from '../graph';

const NODE_SPACING = 160;
const CIRCLE_RADIUS = 24;
const ARROW_SIZE = 20;
const MAX_EXPORT_SIZE = 16384;

export class TreeView {
  private graph: NGFFGraph;
  private containerId: string;
  private width: number = 0;
  private height: number = 0;
  private currentZoom: any;
  /** x position of root node */
  private rootX: number | null = null;

  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private unsubscribers: Array<() => void> = [];

  constructor(graph: NGFFGraph, containerId: string) {
    this.graph = graph;
    this.containerId = containerId;

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
          this.selectNode();
        }
      });

    this.tooltip = d3
      .select('body')
      .append('div')
      .attr('class', `${CSS_CLASS_PREFIX}tree-tooltip`)
      .style('opacity', 0);

    this.unsubscribers.push(graph.addChangeListener(() => this.renderTree()));

    // Also re-render when loading completes
    this.unsubscribers.push(
      graph.addLoadingListener((isLoading) => {
        if (!isLoading) {
          this.renderTree();
        }
      })
    );

    const exportButtons = d3
      .select(`#${containerId}`)
      .append('div')
      .attr('class', 'export-buttons');

    exportButtons
      .append('button')
      .text('Export SVG')
      .on('click', () => this.exportSVG());

    exportButtons
      .append('button')
      .text('Export PNG')
      .on('click', () => this.exportPNG());

    this.unsubscribers.push(this.graph.addNodeSelectedListener(() => this.renderTree()));
    // initial render of the tree
    this.renderTree();
  }

  selectNode(node?: D3Node) {
    this.graph.selectNode(node);
  }

  renderTree() {
    const hierarchy = this.graph.getHierarchy();
    this.width = Math.max(800, hierarchy.leaves().length * NODE_SPACING);
    this.height = Math.max(1, hierarchy.height) * NODE_SPACING;
    // We only want to set the viewBox on the first render
    if (!this.svg.attr('viewBox')) {
      this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    }

    const treeLayout = d3
      .tree<D3Node>()
      .size([this.width, this.height])
      .separation(() => NODE_SPACING);
    treeLayout(this.graph.getHierarchy());

    const descendants = this.graph.getHierarchy().descendants();

    this.svg.selectAll('*').remove();
    this.tooltip.style('opacity', 0);

    const zoomLayer = this.svg.append('g');
    const tree = zoomLayer.append('g');

    const minZoom = 0.1;
    const maxZoom = Math.max(2, this.width / NODE_SPACING / 5);

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
      .attr('viewBox', `0 0 ${ARROW_SIZE} ${ARROW_SIZE}`)
      .attr('refX', ARROW_SIZE)
      .attr('refY', ARROW_SIZE / 2)
      .attr('markerWidth', ARROW_SIZE)
      .attr('markerHeight', ARROW_SIZE)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', `M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} z`)
      .attr('fill', 'context-fill');

    tree
      .selectAll('line.main')
      .data(this.graph.getHierarchy().links())
      .enter()
      .append('line')
      .attr('x1', (d) => Number(d.source.x))
      .attr('y1', (d) => Number(d.source.y))
      // just draw line to the edge of the target circle
      .attr('x2', (d) => {
        const lineDx = Number(d.target.x) - Number(d.source.x);
        const lineDy = Number(d.target.y) - Number(d.source.y);
        const lineLength = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
        const offsetX = (lineDx / lineLength) * CIRCLE_RADIUS;
        return Number(d.target.x) - offsetX;
      })
      .attr('y2', (d) => {
        const lineDx = Number(d.target.x) - Number(d.source.x);
        const lineDy = Number(d.target.y) - Number(d.source.y);
        const lineLength = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
        const offsetY = (lineDy / lineLength) * CIRCLE_RADIUS;
        return Number(d.target.y) - offsetY;
      })
      // if the child (target) has a path, it is considered "remote" (different file from it's parent)
      .attr('stroke', (d) =>
        'path' in d.target.data.omeNode ? STROKE_COLORS.remote : STROKE_COLORS.local
      )
      .attr('fill', (d) =>
        'path' in d.target.data.omeNode ? STROKE_COLORS.remote : STROKE_COLORS.local
      )
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
      .attr('stroke-dasharray', `${ARROW_SIZE / 3}, ${ARROW_SIZE / 3}`)
      .attr('marker-end', 'url(#arrow)');

    tree
      .selectAll('circle')
      .data(descendants)
      .enter()
      .append('circle')
      .attr('cx', (d) => Number(d.x))
      .attr('cy', (d) => Number(d.y))
      .attr('r', CIRCLE_RADIUS)
      .attr('fill', (d) => NODE_COLORS[d.data.omeNode.type] || NODE_COLORS.default)
      .attr('opacity', (d) => (d.data.loaded ? 1 : 0.4))
      .style('cursor', 'pointer')
      .attr('stroke', (d) =>
        d.data.selected ? STROKE_COLORS.selected : d.data.loaded ? 'none' : STROKE_COLORS.inlining
      )
      .attr('stroke-dasharray', (d) => (d.data.loaded ? 'none' : '10,5'))
      .attr('stroke-width', (d) => (d.data.selected ? 5 : 2))
      .on('click', async (event, d) => {
        const node = d.data;
        if ('path' in node.omeNode && node.omeNode.path) {
          if (event.target instanceof SVGCircleElement) {
            event.target.classList.add('ngff-rfc8-viewer-rotating-dash');
          }
          await this.graph.loadNodeWithSignal(
            node as D3Node & { omeNode: OmeNode & { path: OmePath } }
          );
          this.selectNode(node);
          this.renderTree();
          if (event.target instanceof SVGCircleElement) {
            event.target.classList.remove('ngff-rfc8-viewer-rotating-dash');
          }
        } else {
          this.selectNode(node);
        }
      })
      .on('mouseenter', (event, d) => {
        if (event.target instanceof SVGCircleElement) {
          d3.select(event.target).attr('stroke', STROKE_COLORS.hover);
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
          d3.select(event.target)
            .attr(
              'stroke',
              d.data.selected
                ? STROKE_COLORS.selected
                : d.data.loaded
                  ? 'none'
                  : STROKE_COLORS.inlining
            )
            .attr('stroke-width', d.data.selected ? 5 : 2);
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
      .attr('y', (d) => Number(d.y) + 2 * CIRCLE_RADIUS + 5)
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

  private buildExportableSVG() {
    // Recompute initial dimensions
    const hierarchy = this.graph.getHierarchy();
    let k = 1;
    let width = Math.max(800, hierarchy.leaves().length * NODE_SPACING);
    let height = (Math.max(1, hierarchy.height) + 1) * NODE_SPACING;

    // Rescale to fit max allowed size
    if (width > MAX_EXPORT_SIZE || height > MAX_EXPORT_SIZE) {
      const scale = Math.max(width, height) / MAX_EXPORT_SIZE;
      k = k / scale;
      width = width / scale;
      height = height / scale;
    }

    const svgElement = this.svg.node()!.cloneNode(true) as SVGSVGElement;
    const g = svgElement.querySelector('g') as SVGGElement;
    const transform = (g.getAttribute('transform') || '')
      .replace(/translate\([^)]*\)/, `translate(0,${k * CIRCLE_RADIUS})`)
      .replace(/scale\([^)]*\)/, `scale(${k})`);
    g.setAttribute('transform', transform);
    svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);

    svgElement.setAttribute('width', String(width));
    svgElement.setAttribute('height', String(height));

    return svgElement;
  }

  exportSVG() {
    const svgElement = this.buildExportableSVG();
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    this.downloadImage(blob, 'svg');
  }

  exportPNG() {
    const svgElement = this.buildExportableSVG();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = Number(svgElement.getAttribute('width'));
    canvas.height = Number(svgElement.getAttribute('height'));

    const svgString = new XMLSerializer().serializeToString(svgElement);

    // Create an image from the SVG
    const img = new Image();
    img.onload = () => {
      try {
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob !== null) {
            this.downloadImage(blob, 'png');
          } else {
            this.graph.signalError('Unable to draw the image');
          }
        }, 'image/png');
      } catch (err) {
        this.graph.signalError(err instanceof Error ? err.message : 'Unable to generate the image');
      }
    };

    // Trigger image onload
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    img.src = URL.createObjectURL(blob);
  }

  private downloadImage(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tree-${Date.now()}.${extension}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  destroy() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    // remove the svg element created in constructor
    const el = document.getElementById(this.containerId + '-graph');
    if (el) {
      el.remove();
    }
    const exportBtns = document.querySelector(`#${this.containerId} .export-buttons`);
    if (exportBtns) {
      exportBtns.remove();
    }
  }
}
