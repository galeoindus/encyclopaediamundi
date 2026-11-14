/** Optional direct-to-device Ollama client. No cloud proxy and no API key.
 * The fixed loopback origin prevents an imported settings value from sending
 * prompts or images to an arbitrary remote host.
 */
export const OLLAMA_ORIGIN = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:1.5b';

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit', ...options });
  } catch {
    throw new Error('Local Ollama could not be reached. Start Ollama, allow this site in OLLAMA_ORIGINS, and try Connect again.');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Ollama returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function listLocalModels(signal) {
  const response = await request(`${OLLAMA_ORIGIN}/api/tags`, { headers: { accept: 'application/json' }, signal });
  const payload = await response.json();
  return (Array.isArray(payload?.models) ? payload.models : [])
    .map((item) => String(item?.name || item?.model || '').trim())
    .filter(Boolean)
    .slice(0, 100);
}

export async function askLocalOllama({ model = DEFAULT_OLLAMA_MODEL, messages, signal, maxTokens = 1200 }) {
  const chosen = String(model || '').trim().slice(0, 120);
  if (!chosen) throw new Error('Enter the name of a model installed in Ollama.');
  const response = await request(`${OLLAMA_ORIGIN}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    signal,
    body: JSON.stringify({
      model: chosen,
      messages,
      stream: false,
      max_tokens: Math.max(128, Math.min(5000, Number(maxTokens) || 1200)),
      temperature: 0.4,
    }),
  });
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const answer = Array.isArray(content)
    ? content.map((part) => typeof part === 'string' ? part : String(part?.text || '')).join('').trim()
    : String(content || '').trim();
  if (!answer) throw new Error('The local model returned an empty answer. Try a different installed model.');
  return { answer, provider: 'Local Ollama', model: chosen };
}

export function toOllamaImage(dataUrl) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:image\/(?:png|jpe?g|webp);base64,([a-z\d+/=]+)$/i);
  return match ? match[1] : '';
}
