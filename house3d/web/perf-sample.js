// Sample GPU time asynchronously; never wait for the graphics driver.
export function perfSampler(renderer, post) {
  const gl = renderer.getContext(),
    ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let pending = null,
    query = null,
    lastSample = 0,
    at = performance.now(),
    lastStall = at,
    times = [],
    count = {};
  function add(k, n = 1) {
    count[k] = (count[k] || 0) + n;
  }
  function begin(now) {
    if (!ext) return;
    if (pending && gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      gl.deleteQuery(pending);
      pending = null;
    }
    if (pending && gl.getQueryParameter(pending, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        add(
          "gpu_sample_ms",
          gl.getQueryParameter(pending, gl.QUERY_RESULT) / 1e6
        );
        add("gpu_samples");
      }
      gl.deleteQuery(pending);
      pending = null;
    }
    if (
      !pending &&
      now - lastSample >= 1000 &&
      !gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)
    ) {
      query = gl.createQuery();
      if (query) {
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        lastSample = now;
      }
    }
  }
  function end(start, shadow) {
    if (query) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending = query;
      query = null;
    }
    add("frames");
    if (shadow) add("shadow_frames");
    add("submit_ms", performance.now() - start);
    add("calls", renderer.info.render.calls);
    add("triangles", renderer.info.render.triangles);
  }
  function tick(ms, active) {
    add("ticks");
    if (active) add("active_ticks");
    if (ms > 80) add("long_frames");
    if (ms > 250 && performance.now() - lastStall > 10000) {
      lastStall = performance.now();
      post({ stall_ms: ms }).catch(() => {});
    }
    if (times.length < 1024) times.push(ms);
  }
  const timer = setInterval(() => {
    const now = performance.now();
    times.sort((a, b) => a - b);
    post({
      window_ms: now - at,
      buffer_width: gl.drawingBufferWidth,
      buffer_height: gl.drawingBufferHeight,
      active_ticks: 0,
      ticks: 0,
      frames: 0,
      calls: 0,
      triangles: 0,
      shadow_frames: 0,
      ...count,
      frame_p95_ms: times[Math.floor(times.length * 0.95)] || 0,
    }).catch(() => {});
    times = [];
    count = {};
    at = now;
  }, 15000);
  return {
    tick,
    begin,
    end,
    add,
    dispose() {
      clearInterval(timer);
      if (pending) gl.deleteQuery(pending);
    },
  };
}
