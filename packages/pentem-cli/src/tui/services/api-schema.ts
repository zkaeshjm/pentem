import * as fs from 'node:fs';

export interface ApiEndpoint {
  method: string;
  path: string;
  contentType: string;
  parameters: Array<{ name: string; in: string; required: boolean; type: string }>;
  requestBody?: string;
  authRequired: boolean;
  description: string;
}

export interface ApiSchema {
  format: 'openapi' | 'graphql' | 'unknown';
  title: string;
  version: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
}

export async function fetchOpenApiSchema(baseUrl: string): Promise<ApiSchema | null> {
  const paths = [
    '/openapi.json',
    '/swagger.json',
    '/api/openapi.json',
    '/api/swagger.json',
    '/api-docs',
    '/swagger/v1/swagger.json',
    '/api/v1/openapi.json',
    '/openapi.yaml',
    '/spec.yaml',
    '/v3/api-docs',
  ];

  for (const p of paths) {
    try {
      const url = `${baseUrl.replace(/\/+$/, '')}${p}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) continue;
      const text = await resp.text();
      const parsed = tryParseOpenApi(text, url);
      if (parsed) return parsed;
    } catch {}
  }
  return null;
}

export async function fetchGraphqlSchema(baseUrl: string): Promise<ApiSchema | null> {
  const graphqlUrl = `${baseUrl.replace(/\/+$/, '')}/graphql`;
  try {
    const resp = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ __schema { types { name description fields { name description args { name } } } } }',
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;

    const introspectionQuery = JSON.stringify({
      query: `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            types {
              name
              kind
              description
              fields {
                name
                description
                args { name type { name kind } }
                type { name kind ofType { name kind } }
              }
            }
          }
        }
      `,
    });

    const introResp = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: introspectionQuery,
      signal: AbortSignal.timeout(10000),
    });
    if (!introResp.ok) return null;

    const data = (await introResp.json()) as { data?: { __schema?: Record<string, unknown> } };
    const schema = data?.data?.__schema;
    if (!schema) return null;

    const endpoints: ApiEndpoint[] = [];
    const types = (schema.types ?? []) as Array<Record<string, unknown>>;
    for (const type of types) {
      const typeName = type.name as string;
      if (typeName.startsWith('__') || !type.fields) continue;
      const fields = type.fields as Array<Record<string, unknown>>;
      for (const field of fields) {
        endpoints.push({
          method: 'GQL_QUERY',
          path: '/graphql',
          contentType: 'application/json',
          parameters: ((field.args ?? []) as Array<Record<string, unknown>>).map((a) => ({
            name: a.name as string,
            in: 'query',
            required: !((a.type as Record<string, unknown>)?.name as string)?.endsWith('?'),
            type: ((a.type as Record<string, unknown>)?.name as string) ?? 'unknown',
          })),
          authRequired: false,
          description: (field.description as string) ?? '',
        });
      }
    }

    return {
      format: 'graphql',
      title: ((schema.queryType as Record<string, unknown>)?.name as string) ?? 'GraphQL Schema',
      version: 'introspection',
      baseUrl: graphqlUrl,
      endpoints,
    };
  } catch {
    return null;
  }
}

export async function fetchAnySchema(baseUrl: string): Promise<ApiSchema | null> {
  const openapi = await fetchOpenApiSchema(baseUrl);
  if (openapi) return openapi;
  const graphql = await fetchGraphqlSchema(baseUrl);
  if (graphql) return graphql;
  return null;
}

function tryParseOpenApi(text: string, url: string): ApiSchema | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;

    const isOpenApi = data.openapi || data.swagger;
    if (!isOpenApi) return null;

    const endpoints: ApiEndpoint[] = [];
    const servers = data.servers as Array<Record<string, unknown>> | undefined;
    const baseUrl = servers?.[0]?.url ?? (data.host as string) ?? url;

    const paths = data.paths as Record<string, unknown> | undefined;
    if (paths) {
      for (const [path, methods] of Object.entries(paths)) {
        if (!methods || typeof methods !== 'object') continue;
        for (const [method, spec] of Object.entries(methods as Record<string, unknown>)) {
          if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) continue;
          const s = spec as Record<string, unknown>;
          const consumes = s.consumes as string[] | undefined;
          const parameters = (s.parameters as Array<Record<string, unknown>> | undefined) ?? [];
          endpoints.push({
            method: method.toUpperCase(),
            path,
            contentType: consumes?.[0] ?? 'application/json',
            parameters: parameters.map((p) => ({
              name: p.name as string,
              in: (p.in as string) ?? 'query',
              required: (p.required as boolean) ?? false,
              type: (p.type as string) ?? ((p.schema as Record<string, unknown>)?.type as string) ?? 'string',
            })),
            authRequired: s.security !== undefined,
            description: (s.description as string) ?? '',
          });
        }
      }
    }

    const info = data.info as Record<string, unknown> | undefined;
    return {
      format: 'openapi',
      title: (info?.title as string) ?? 'API',
      version: (info?.version as string) ?? 'unknown',
      baseUrl: typeof baseUrl === 'string' ? baseUrl : url,
      endpoints,
    };
  } catch {
    return null;
  }
}
