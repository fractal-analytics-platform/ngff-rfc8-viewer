import type { OmeNode } from './types';

export class NGFFLoader {
  private source: string;
  private prefix: string;

  constructor(source: string) {
    this.source = source;
    if (!this.source.endsWith('.json')) {
      this.source += 'zarr.json';
    }

    this.prefix = this.source.endsWith('.json')
      ? this.source.substring(0, this.source.search(/\/[^/]+\.json$/))
      : this.source;
  }

  async loadGraphData(): Promise<OmeNode> {
    let url: URL;
    try {
      url = new URL(this.source);
    } catch {
      throw new Error(`Unable to load data: source is not a valid URL`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Unable to load data: protocol ${url.protocol} is not supported`);
    }

    return await this.loadNode(this.source);
  }

  async loadNode(source: string): Promise<OmeNode> {
    if (source.startsWith('./')) {
      source = `${this.prefix}${source.substring(1)}`;
    } else if (!source.startsWith(this.prefix)) {
      throw new Error(`Unable to load ${source}: URL doesn't start with ${this.prefix}`);
    }
    const response = await fetch(source, {
      mode: 'cors',
      cache: 'no-cache'
    });
    if (response.ok) {
      const content = await response.text();
      try {
        const data = JSON.parse(content);
        return this.getOme(data);
      } catch {
        throw new Error(`Unable to load ${source}: invalid JSON content`);
      }
    } else {
      throw new Error(
        `Unexpected response from server while loading ${source}. Status: ${response.status}`
      );
    }
  }

  getOme(data: any): OmeNode {
    if ('ome' in data) {
      return data.ome;
    } else if ('attributes' in data && 'ome' in data.attributes) {
      return data.attributes.ome;
    }
    throw new Error('Payload does not contain ome field');
  }
}
