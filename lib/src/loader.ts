export async function loadGraphData(source: string) {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error(`Unable to load data: source is not a valid URL`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unable to load data: protocol ${url.protocol} is not supported`);
  }

  const prefix = source.endsWith('.json')
    ? source.substring(0, source.search(/\/[^/]+\.json$/))
    : source;

  if (!source.endsWith('.json')) {
    source += 'zarr.json';
  }

  return await loadNode(source, prefix);
}

export async function loadNode(source: string, prefix: string) {
  if (!source.startsWith(prefix)) {
    throw new Error(`Unable to load ${source}: URL doesn't start with ${prefix}`);
  }
  const response = await fetch(source, {
    mode: 'cors'
  });
  if (response.ok) {
    const content = await response.text();
    try {
      const data = JSON.parse(content);
      return data;
    } catch {
      throw new Error(`Unable to load ${source}: invalid JSON content`);
    }
  } else {
    throw new Error(
      `Unexpected response from server while loading ${source}. Status: ${response.status}`
    );
  }
}
