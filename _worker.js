/**
 * Keepsafe Vault — Cloudflare Worker & Pages Sync Engine
 * Handles /api/vault and /health endpoints + serves static web assets
 */
const memoryCache = new Map();

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Secret',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 1. Health check endpoint
    if (url.pathname === '/health') {
      const hasKV = !!env.VAULT_KV;
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'Keepsafe Vault Cloudflare Sync',
        kv_bound: hasKV,
        storage_type: hasKV ? 'Cloudflare KV (Permanent Cloud Storage)' : 'Memory Cache',
        time: new Date().toISOString()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Vault Sync API
    if (url.pathname === '/api/vault') {
      if (request.method === 'GET') {
        const userId = url.searchParams.get('user_id');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: corsHeaders });
        }

        let encryptedData = null;
        let updatedAt = null;

        if (env.VAULT_KV) {
          const raw = await env.VAULT_KV.get(`vault:${userId}`);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              encryptedData = parsed.encrypted_data || parsed;
              updatedAt = parsed.updated_at || null;
            } catch (e) {
              encryptedData = JSON.parse(raw);
            }
          }
        } else {
          const cached = memoryCache.get(userId);
          if (cached) {
            encryptedData = cached.encrypted_data;
            updatedAt = cached.updated_at;
          }
        }

        if (!encryptedData) {
          return new Response(JSON.stringify({ found: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ found: true, user_id: userId, encrypted_data: encryptedData, updated_at: updatedAt }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const { user_id, encrypted_data, updated_at } = body;
          if (!user_id || !encrypted_data) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
          }

          const record = { user_id, encrypted_data, updated_at: updated_at || new Date().toISOString() };
          if (env.VAULT_KV) {
            await env.VAULT_KV.put(`vault:${user_id}`, JSON.stringify(record));
          } else {
            memoryCache.set(user_id, record);
          }

          return new Response(JSON.stringify({ success: true, user_id, updated_at: record.updated_at }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Invalid JSON: ' + err.message }), { status: 400, headers: corsHeaders });
        }
      }
    }

    // 3. Fallback: I-serve ang static HTML (Keepsafe Vault app)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Keepsafe Vault Worker Online. Endpoint: /api/vault', { headers: corsHeaders });
  }
};
