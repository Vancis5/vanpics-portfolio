export class CounterDO {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    let rawPath = url.searchParams.get('path') || '/';
    let path = rawPath.trim().slice(0, 128);
    if (!/^\/[a-zA-Z0-9_.\-\/]*$/.test(path)) {
      path = '/';
    }

    if (request.method === 'POST') {
      let total = (await this.state.storage.get('total')) || 0;
      let pathViews = (await this.state.storage.get(`path:${path}`)) || 0;

      total++;
      pathViews++;

      await this.state.storage.put({
        total,
        [`path:${path}`]: pathViews,
      });

      return new Response(JSON.stringify({ success: true, total, pathViews }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'GET') {
      const total = (await this.state.storage.get('total')) || 0;
      const pathViews = (await this.state.storage.get(`path:${path}`)) || 0;
      return new Response(JSON.stringify({ total, pathViews }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
