/** Source projection adapted from @lyd123qw2008/dsh-web-search-codex (MIT). */
export function extractResponsesText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  return (response.output ?? []).filter(x => x.type === 'message')
    .flatMap(x => typeof x.output_text === 'string' ? [x.output_text] : (x.content ?? []).filter(p => ['output_text', 'text'].includes(p.type)).map(p => p.text ?? ''))
    .join('');
}

/** Merge native tool sources and structured citations, retaining titles from either. */
export function extractResponsesSources(response) {
  const byURL = new Map();
  const add = item => {
    if (typeof item?.url !== 'string') return;
    let url;
    try { url = new URL(item.url); } catch { return; }
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const existing = byURL.get(item.url) ?? { url: item.url };
    if (typeof item.title === 'string' && item.title.trim()) existing.title = item.title;
    byURL.set(item.url, existing);
  };
  for (const item of response.output ?? []) {
    if (item.type === 'web_search_call') for (const source of item.action?.sources ?? []) add(source);
    if (item.type === 'message') for (const part of item.content ?? []) {
      for (const annotation of part.annotations ?? []) if (annotation.type === 'url_citation') add(annotation);
    }
  }
  return [...byURL.values()];
}
