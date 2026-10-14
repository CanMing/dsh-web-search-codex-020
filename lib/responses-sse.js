/** Incremental Responses SSE parser adapted from @lyd123qw2008/dsh-web-search-codex (MIT). */
export function createResponsesSseParser(onEvent) {
  let buffer = '';
  let eventName = '';
  let dataLines = [];
  let stopped = false;
  const dispatch = () => {
    if (!dataLines.length) { eventName = ''; return; }
    const text = dataLines.join('\n');
    if (onEvent({ event: eventName || 'message', data: text === '[DONE]' ? text : JSON.parse(text) }) === false) stopped = true;
    eventName = '';
    dataLines = [];
  };
  const processLine = line => {
    if (!line) return dispatch();
    if (line.startsWith(':')) return;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    if (field === 'data') dataLines.push(value);
  };
  return {
    get done() { return stopped; },
    push(chunk) {
      if (stopped) return;
      buffer += chunk;
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) break;
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        processLine(line);
        if (stopped) { buffer = ''; break; }
      }
    },
    end() {
      if (stopped) return;
      if (buffer.length) processLine(buffer.replace(/\r$/u, ''));
      buffer = '';
      dispatch();
    },
  };
}

export async function consumeResponsesSseResponse(response, onEvent, signal) {
  if (!response.body) throw new Error('Responses streaming response has no body');
  const reader = response.body.getReader();
  const parser = createResponsesSseParser(onEvent);
  const decoder = new TextDecoder();
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    signal?.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (parser.done) return;
    }
    parser.push(decoder.decode());
    parser.end();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
