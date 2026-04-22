function getEnv(name, fallback = '') {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function parseSseChunk(buffer) {
  const events = [];
  const lines = buffer.split(/\r?\n/);
  let current = '';

  for (const line of lines) {
    if (!line.trim()) {
      if (current.trim()) {
        events.push(current.trim());
        current = '';
      }
      continue;
    }
    if (line.startsWith('data:')) {
      current += `${line.slice(5).trim()}\n`;
    }
  }

  return { events, remainder: current };
}

export function createDoubaoClient(options = {}) {
  const baseUrl = options.baseUrl ?? getEnv('DOUBAO_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3');
  const apiKey = options.apiKey ?? getEnv('DOUBAO_API_KEY');
  const model = options.model ?? getEnv('DOUBAO_MODEL');

  if (!apiKey) throw new Error('Missing DOUBAO_API_KEY');
  if (!model) throw new Error('Missing DOUBAO_MODEL');

  async function chatCompletions(payload, { stream = false } = {}) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify({
        model,
        ...payload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Doubao request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    return response;
  }

  async function createMessage(messages, options = {}) {
    const payload = {
      messages,
      thinking: options.thinking ?? { type: 'enabled' },
      reasoning_effort: options.reasoning_effort ?? 'medium',
      temperature: options.temperature ?? 0.2,
      top_p: options.top_p ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
    };

    if (options.tools) payload.tools = options.tools;
    if (options.tool_choice) payload.tool_choice = options.tool_choice;
    if (options.parallel_tool_calls !== undefined) payload.parallel_tool_calls = options.parallel_tool_calls;
    if (options.stream_options) payload.stream_options = options.stream_options;

    const response = await chatCompletions(payload, { stream: false });
    return response.json();
  }

  async function* streamMessage(messages, options = {}) {
    const payload = {
      messages,
      thinking: options.thinking ?? { type: 'enabled' },
      reasoning_effort: options.reasoning_effort ?? 'medium',
      temperature: options.temperature ?? 0.2,
      top_p: options.top_p ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
      stream_options: options.stream_options ?? { include_usage: true },
    };

    if (options.tools) payload.tools = options.tools;
    if (options.tool_choice) payload.tool_choice = options.tool_choice;
    if (options.parallel_tool_calls !== undefined) payload.parallel_tool_calls = options.parallel_tool_calls;

    const response = await chatCompletions(payload, { stream: true });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = parseSseChunk(buffer);
      buffer = remainder;

      for (const event of events) {
        if (event === '[DONE]') return;
        try {
          const json = JSON.parse(event);
          const delta = json?.choices?.[0]?.delta;
          if (delta) yield delta;
        } catch {
          continue;
        }
      }
    }
  }

  return {
    model,
    baseUrl,
    createMessage,
    streamMessage,
  };
}
