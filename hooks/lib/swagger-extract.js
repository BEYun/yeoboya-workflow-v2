'use strict';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function schemaDefs(spec) {
  if (spec && spec.definitions) return spec.definitions;
  if (spec && spec.components && spec.components.schemas) return spec.components.schemas;
  return {};
}

function refName(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (typeof schema.$ref === 'string') {
    const parts = schema.$ref.split('/');
    return parts[parts.length - 1] || null;
  }
  if (schema.type === 'array' && schema.items) {
    const inner = refName(schema.items);
    return inner ? inner + '[]' : null;
  }
  return null;
}

function jsonBodySchema(content) {
  if (!content || typeof content !== 'object') return null;
  const json = content['application/json'] || content[Object.keys(content)[0]];
  return json && json.schema ? json.schema : null;
}

function requestRef(op) {
  if (op.requestBody && op.requestBody.content) {          // OpenAPI 3.x
    const s = jsonBodySchema(op.requestBody.content);
    if (s) return refName(s);
  }
  if (Array.isArray(op.parameters)) {                       // Swagger 2.0
    const body = op.parameters.find((p) => p && p.in === 'body' && p.schema);
    if (body) return refName(body.schema);
  }
  return null;
}

function responseRef(op) {
  const responses = op.responses || {};
  const codes = Object.keys(responses);
  const code = codes.find((c) => /^2\d\d$/.test(c)) || codes.find((c) => c === 'default') || codes[0];
  if (!code) return null;
  const resp = responses[code];
  if (!resp) return null;
  if (resp.content) {                                       // 3.x
    const s = jsonBodySchema(resp.content);
    if (s) return refName(s);
  }
  if (resp.schema) return refName(resp.schema);             // 2.0
  return null;
}

function baseName(ref) {
  return ref ? ref.replace(/\[\]$/, '') : null;
}

function matchesFilter(method, apiPath, filters) {
  if (!filters || filters.length === 0) return true;
  const hay = (method + ' ' + apiPath).toLowerCase();
  return filters.some((f) => hay.includes(String(f).toLowerCase()));
}

function fieldType(prop) {
  if (!prop || typeof prop !== 'object') return 'unknown';
  const ref = refName(prop);
  if (ref) return ref;
  if (prop.type) return prop.type;
  return 'object';
}

function renderDto(name, defs) {
  const def = defs[name];
  const lines = ['#### ' + name];
  if (!def || typeof def !== 'object') {
    lines.push('- (정의 없음)');
    return lines.join('\n');
  }
  const props = def.properties || {};
  const required = new Set(Array.isArray(def.required) ? def.required : []);
  const keys = Object.keys(props);
  if (keys.length === 0) {
    lines.push('- (필드 없음' + (def.type ? ': ' + def.type : '') + ')');
    return lines.join('\n');
  }
  for (const k of keys) {
    lines.push('- ' + k + ': ' + fieldType(props[k]) + (required.has(k) ? ' (required)' : ''));
  }
  return lines.join('\n');
}

function parseSwagger(spec, opts = {}) {
  const filters = opts.endpoints || [];
  const defs = schemaDefs(spec);
  const paths = (spec && spec.paths) || {};
  const endpointLines = [];
  const usedDtos = new Set();

  for (const p of Object.keys(paths)) {
    const item = paths[p] || {};
    for (const m of HTTP_METHODS) {
      if (!item[m]) continue;
      if (!matchesFilter(m, p, filters)) continue;
      const op = item[m];
      const summary = op.summary || op.operationId || '';
      endpointLines.push('- `' + m.toUpperCase() + ' ' + p + '`' + (summary ? ' — ' + summary : ''));
      const reqRef = requestRef(op);
      const resRef = responseRef(op);
      if (reqRef) {
        endpointLines.push('  - 요청: `' + reqRef + '`');
        const b = baseName(reqRef); if (b) usedDtos.add(b);
      }
      if (resRef) {
        endpointLines.push('  - 응답: `' + resRef + '`');
        const b = baseName(resRef); if (b) usedDtos.add(b);
      }
    }
  }

  const out = [];
  out.push('### 엔드포인트');
  out.push(endpointLines.length ? endpointLines.join('\n') : '- (없음)');
  out.push('');
  out.push('### DTO');
  if (usedDtos.size === 0) {
    out.push('- (참조된 DTO 없음)');
  } else {
    for (const name of [...usedDtos].sort()) {
      out.push(renderDto(name, defs));
    }
  }
  return out.join('\n');
}

module.exports = { parseSwagger, refName, schemaDefs };
