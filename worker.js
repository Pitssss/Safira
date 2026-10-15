/**
 * Keepsafe Vault - Cloudflare Worker All-in-One Engine
 * Serves the Keepsafe Vault Web App AND handles KV Synchronization
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

    // Health check endpoint
    if (url.pathname === '/health') {
      const hasKV = !!env.VAULT_KV;
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'Keepsafe Cloudflare Vault Sync',
        kv_bound: hasKV,
        storage_type: hasKV ? 'Cloudflare KV (Persistent)' : 'Memory Cache',
        time: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vault Data API
    if (url.pathname === '/api/vault') {
      if (request.method === 'GET') {
        const userId = url.searchParams.get('user_id');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing user_id parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
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
          return new Response(JSON.stringify({ found: false }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          found: true,
          encrypted_data: encryptedData,
          updated_at: updatedAt
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const { user_id, encrypted_data, updated_at } = body;

          if (!user_id || !encrypted_data) {
            return new Response(JSON.stringify({ error: 'Missing user_id or encrypted_data' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const record = {
            user_id,
            encrypted_data,
            updated_at: updated_at || new Date().toISOString()
          };

          if (env.VAULT_KV) {
            await env.VAULT_KV.put(`vault:${user_id}`, JSON.stringify(record));
          } else {
            memoryCache.set(user_id, record);
          }

          return new Response(JSON.stringify({
            success: true,
            user_id,
            kv_persisted: !!env.VAULT_KV,
            updated_at: record.updated_at
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload: ' + err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Default: Serve the full Keepsafe Vault Web App
    const appHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Keepsafe — Document Vault</title>
  <meta name="google" content="notranslate">
<meta name="description" content="Keepsafe is a secure, local document vault that keeps your important files safe in your browser.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <style>
:root{
    --bg:#0D0F10;
    --surface:#15181A;
    --surface-2:#1D2123;
    --surface-3:#262B2E;
    --border:#2A2F32;
    --border-soft:#232729;
    --text:#ECE8DF;
    --text-dim:#9B9D97;
    --text-faint:#6C6E69;
    --brass:#C89B4C;
    --brass-bright:#E0B664;
    --brass-dim:#8A6E3A;
    --ok:#6FA97A;
    --ok-bg:rgba(111,169,122,0.12);
    --warn:#D0A34A;
    --warn-bg:rgba(208,163,74,0.14);
    --bad:#C9684F;
    --bad-bg:rgba(201,104,79,0.14);
    --radius-s:6px;
    --radius-m:10px;
    --radius-l:16px;
    --shadow-lift: 0 12px 32px rgba(0,0,0,0.45);
  }
  :root:not([data-theme="light"]){ }
  :root[data-theme="light"]{
    --bg:#F4F1EA;
    --surface:#FFFFFF;
    --surface-2:#F7F5F0;
    --surface-3:#EDE9E0;
    --border:#DFD9CB;
    --border-soft:#E9E4D8;
    --text:#211D16;
    --text-dim:#6B675C;
    --text-faint:#989385;
    --brass:#A97F2E;
    --brass-bright:#8C6A26;
    --brass-dim:#C9A968;
    --ok:#3D7A4C;
    --ok-bg:rgba(61,122,76,0.10);
    --warn:#A57621;
    --warn-bg:rgba(165,118,33,0.12);
    --bad:#A6432B;
    --bad-bg:rgba(166,67,43,0.10);
    --shadow-lift: 0 12px 32px rgba(30,25,15,0.12);
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{
    background:var(--bg);
    color:var(--text);
    font-family:'Inter',-apple-system,sans-serif;
    min-height:100vh;
    -webkit-font-smoothing:antialiased;
  }
  h1,h2,h3,.serif{font-family:'Fraunces',serif;}
  button{font-family:inherit;}
  ::selection{background:var(--brass-dim);color:#0D0F10;}
  a{color:inherit;}

  /* ---------- Scaffold ---------- */
  #app{display:none;}
  #app.ready{display:flex;}
  .app-shell{
    display:flex;
    width:100%;
    min-height:100vh;
  }

  /* ---------- Auth screens ---------- */
  .gate{
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:32px 20px;
    position:relative;
    overflow:hidden;
  }
  /* Animated background orbs */
  .gate::before, .gate::after{
    content:"";
    position:absolute;
    border-radius:50%;
    filter:blur(100px);
    opacity:0.15;
    animation:float 12s ease-in-out infinite;
    pointer-events:none;
  }
  .gate::before{
    width:500px; height:500px;
    background:var(--brass);
    top:-15%; left:-10%;
    animation-delay:0s;
  }
  .gate::after{
    width:400px; height:400px;
    background:var(--brass-bright);
    bottom:-15%; right:-10%;
    animation-delay:-6s;
  }
  @keyframes float{
    0%, 100%{ transform:translate(0,0) scale(1); }
    33%{ transform:translate(30px,-20px) scale(1.05); }
    66%{ transform:translate(-20px,15px) scale(0.95); }
  }

  .gate-card{
    width:100%;
    max-width:420px;
    text-align:center;
    position:relative;
    z-index:2;
    animation:fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes fadeSlideUp{
    from{ opacity:0; transform:translateY(24px); }
    to{ opacity:1; transform:translateY(0); }
  }

  /* Glass card wrapper for auth */
  .auth-glass{
    background:rgba(21,24,26,0.7);
    backdrop-filter:blur(24px);
    -webkit-backdrop-filter:blur(24px);
    border:1px solid var(--border-soft);
    border-radius:var(--radius-l);
    padding:36px 32px 32px 32px;
    box-shadow:var(--shadow-lift), 0 0 0 1px rgba(200,155,76,0.04);
  }
  :root[data-theme="light"] .auth-glass{
    background:rgba(255,255,255,0.75);
  }

  .dial{
    width:84px;height:84px;margin:0 auto 28px auto;
    border-radius:50%;
    border:1.5px solid var(--border);
    position:relative;
    background:radial-gradient(circle at 35% 30%, var(--surface-2), var(--surface));
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02), var(--shadow-lift);
  }
  .dial::before{
    content:"";
    position:absolute; inset:14px;
    border-radius:50%;
    border:1px solid var(--border);
  }
  .dial::after{
    content:"";
    position:absolute;
    top:8px; left:50%;
    width:2px; height:14px;
    background:var(--brass);
    transform:translateX(-50%);
    border-radius:2px;
  }
  .dial .pin{
    position:absolute; top:50%; left:50%;
    width:6px; height:6px; border-radius:50%;
    background:var(--brass);
    transform:translate(-50%,-50%);
    box-shadow:0 0 10px rgba(200,155,76,0.6);
  }
  /* Spinning animation on the dial notch */
  .dial.spin::after{
    animation:dialSpin 0.6s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes dialSpin{
    0%{ transform:translateX(-50%) rotate(0deg); transform-origin:center 34px; }
    50%{ transform:translateX(-50%) rotate(180deg); transform-origin:center 34px; }
    100%{ transform:translateX(-50%) rotate(360deg); transform-origin:center 34px; }
  }

  .gate h1{font-size:26px; font-weight:600; margin:0 0 6px 0; letter-spacing:0.2px;}
  .gate p.sub{color:var(--text-dim); font-size:14px; margin:0 0 28px 0; line-height:1.5;}
  .pass-input-wrap{position:relative; margin-bottom:14px;}
  input[type="password"], input[type="text"], input[type="email"], input[type="date"], input[type="file"], select, textarea{
    width:100%;
    background:var(--surface-2);
    border:1px solid var(--border);
    color:var(--text);
    border-radius:var(--radius-s);
    padding:12px 14px;
    font-size:14.5px;
    font-family:inherit;
    outline:none;
    transition:border-color .15s ease, box-shadow .15s ease;
  }
  input:focus, select:focus, textarea:focus{
    border-color:var(--brass-dim);
    box-shadow:0 0 0 3px rgba(200,155,76,0.08);
  }
  .gate input[type="password"]{letter-spacing:3px; font-size:16px;}

  /* Auth input with icon */
  .auth-field{position:relative; margin-bottom:14px;}
  .auth-field .field-icon{
    position:absolute; left:13px; top:50%; transform:translateY(-50%);
    width:16px; height:16px; color:var(--text-faint);
    pointer-events:none;
    transition:color .15s ease;
  }
  .auth-field input{padding-left:38px;}
  .auth-field input:focus ~ .field-icon,
  .auth-field input:not(:placeholder-shown) ~ .field-icon{ color:var(--brass); }

  /* Password visibility toggle */
  .pass-toggle{
    position:absolute; right:12px; top:50%; transform:translateY(-50%);
    background:none; border:none; color:var(--text-faint); cursor:pointer;
    padding:4px; display:flex; align-items:center; justify-content:center;
  }
  .pass-toggle:hover{ color:var(--text-dim); }

  .btn{
    display:inline-flex; align-items:center; justify-content:center; gap:8px;
    border:none; cursor:pointer;
    border-radius:var(--radius-s);
    font-weight:600;
    font-size:14px;
    padding:12px 20px;
    transition:filter .15s ease, transform .05s ease, box-shadow .15s ease;
  }
  .btn:active{transform:scale(0.98);}
  .btn-primary{background:var(--brass); color:#191307;}
  .btn-primary:hover{filter:brightness(1.08); box-shadow:0 4px 20px rgba(200,155,76,0.25);}
  .btn-primary:disabled{opacity:0.45; cursor:not-allowed;}
  .btn-ghost{background:transparent; color:var(--text-dim); border:1px solid var(--border);}
  .btn-ghost:hover{color:var(--text); border-color:var(--brass-dim);}
  .btn-block{width:100%;}
  .gate-error{color:var(--bad); font-size:13px; margin-top:12px; min-height:16px; transition:opacity .2s ease;}
  .gate-foot{margin-top:22px; font-size:13px;}
  .gate-foot a{color:var(--text-faint); text-decoration:underline; cursor:pointer; transition:color .15s ease;}
  .gate-foot a:hover{color:var(--brass);}
  .hint-row{display:flex; align-items:flex-start; gap:8px; text-align:left; background:var(--surface-2); border:1px solid var(--border-soft); border-radius:var(--radius-s); padding:12px 14px; margin-top:18px; font-size:12.5px; color:var(--text-dim); line-height:1.5;}

  /* Auth tab switcher */
  .auth-tabs{
    display:flex; gap:0; margin-bottom:28px;
    background:var(--surface-2);
    border:1px solid var(--border-soft);
    border-radius:var(--radius-s);
    padding:3px;
    position:relative;
  }
  .auth-tab{
    flex:1; padding:9px 16px; text-align:center;
    font-size:13.5px; font-weight:600;
    color:var(--text-faint); cursor:pointer;
    border-radius:4px;
    transition:color .2s ease, background .2s ease;
    position:relative; z-index:2;
    border:none; background:none;
    font-family:inherit;
  }
  .auth-tab:hover{color:var(--text-dim);}
  .auth-tab.active{color:var(--text); background:var(--surface-3);}

  /* Strength meter */
  .strength-bar{
    display:flex; gap:4px; margin-top:8px;
    height:3px;
  }
  .strength-seg{
    flex:1; border-radius:2px;
    background:var(--surface-3);
    transition:background .3s ease;
  }
  .strength-label{
    font-size:11px; color:var(--text-faint); margin-top:6px;
    text-align:left; transition:color .3s ease;
  }

  /* Remember me */
  .remember-row{
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:18px; margin-top:4px;
  }
  .remember-check{
    display:flex; align-items:center; gap:8px;
    font-size:13px; color:var(--text-dim); cursor:pointer;
  }
  .remember-check input[type="checkbox"]{
    width:15px; height:15px; accent-color:var(--brass);
    cursor:pointer;
  }
  .forgot-link{
    font-size:12.5px; color:var(--text-faint); text-decoration:none;
    cursor:pointer; transition:color .15s ease;
  }
  .forgot-link:hover{color:var(--brass);}

  /* Loading spinner */
  .btn-spinner{
    width:16px; height:16px;
    border:2px solid rgba(25,19,7,0.3);
    border-top-color:#191307;
    border-radius:50%;
    animation:spin 0.6s linear infinite;
    display:none;
  }
  .btn.loading .btn-spinner{display:block;}
  .btn.loading .btn-text{opacity:0.5;}
  @keyframes spin{ to{ transform:rotate(360deg); } }

  /* ---------- Sidebar ---------- */
  .sidebar{
    width:264px; flex-shrink:0;
    background:var(--surface);
    border-right:1px solid var(--border-soft);
    display:flex; flex-direction:column;
    padding:20px 14px;
    min-height:100vh;
  }
  .brand{display:flex; align-items:center; gap:10px; padding:4px 8px 22px 8px;}
  .brand-mark{width:26px;height:26px; flex-shrink:0;}
  .brand-name{font-family:'Fraunces',serif; font-weight:600; font-size:17px; letter-spacing:0.2px;}
  .profile-card{
    display:flex; align-items:center; gap:11px;
    padding:12px; margin-bottom:18px;
    background:var(--surface-2); border:1px solid var(--border-soft); border-radius:var(--radius-m);
    position:relative;
    overflow:hidden;
  }
  .profile-card::after{
    content:"";
    position:absolute; top:0; right:0;
    width:60px; height:60px;
    background:radial-gradient(circle, rgba(200,155,76,0.08), transparent);
    border-radius:50%;
    pointer-events:none;
  }
  .avatar{
    width:38px;height:38px; border-radius:50%;
    background:linear-gradient(155deg,var(--brass-bright),var(--brass-dim));
    display:flex; align-items:center; justify-content:center;
    font-weight:700; font-size:14px; color:#191307; flex-shrink:0;
    text-transform:uppercase;
  }
  .profile-meta{min-width:0;}
  .profile-name{font-size:13.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
  .profile-sub{font-size:11.5px; color:var(--text-faint); margin-top:1px;}
  .fill-bar{height:3px; background:var(--surface-3); border-radius:2px; margin-top:8px; overflow:hidden;}
  .fill-bar-in{height:100%; background:var(--brass); border-radius:2px; transition:width .3s ease;}

  .nav-item{
    display:flex; align-items:center; gap:10px;
    padding:9px 10px; border-radius:var(--radius-s);
    font-size:13.5px; color:var(--text-dim); cursor:pointer;
    margin-bottom:2px; border:1px solid transparent;
    position:relative;
    transition:background .12s ease, color .12s ease;
  }
  .nav-item:hover{background:var(--surface-2); color:var(--text);}
  .nav-item.active{background:var(--surface-2); color:var(--text); border-color:var(--border-soft);}
  .nav-item.active .nav-ic{color:var(--brass);}
  .nav-ic{width:16px; height:16px; flex-shrink:0; color:var(--text-faint); display:flex;}
  .nav-item.active .nav-ic svg, .nav-item:hover .nav-ic svg{color:inherit;}
  .nav-label{flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
  .nav-count{font-size:11.5px; color:var(--text-faint); font-variant-numeric:tabular-nums;}
  .nav-item.active .nav-count{color:var(--brass);}
  .status-dot{width:6px;height:6px;border-radius:50%; flex-shrink:0;}
  .nav-section-label{font-size:10.5px; letter-spacing:0.6px; color:var(--text-faint); margin:16px 10px 8px 10px; font-weight:600;}
  .sidebar-spacer{flex:1;}
  .sidebar-foot{border-top:1px solid var(--border-soft); padding-top:10px; margin-top:10px;}

  /* ---------- Main ---------- */
  .main{flex:1; min-width:0; padding:28px 36px 60px 36px;}
  .main-header{display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:18px; flex-wrap:wrap;}
  .main-title{font-size:24px; font-weight:600; margin:0 0 4px 0;}
  .main-sub{font-size:13px; color:var(--text-dim); margin:0;}
  .toolbar{display:flex; align-items:center; gap:10px; margin-bottom:20px; flex-wrap:wrap;}
  .search-wrap{position:relative; flex:1; min-width:220px; max-width:360px;}
  .search-wrap svg{position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); width:15px; height:15px;}
  .search-wrap input{padding-left:34px;}
  .chip{
    display:inline-flex; align-items:center; gap:6px;
    padding:7px 13px; border-radius:999px; font-size:12.5px; font-weight:600;
    background:var(--surface-2); border:1px solid var(--border-soft); color:var(--text-dim);
    cursor:pointer; white-space:nowrap;
    transition:border-color .12s ease, color .12s ease, background .12s ease;
  }
  .chip:hover{border-color:var(--border);}
  .chip.active{background:var(--surface-3); color:var(--text); border-color:var(--border);}
  .chip .dot{width:6px;height:6px;border-radius:50%;}

  .grid{
    display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px;
  }
  .card{
    background:var(--surface); border:1px solid var(--border-soft); border-radius:var(--radius-m);
    padding:16px; cursor:pointer; position:relative;
    transition:border-color .15s ease, transform .1s ease, box-shadow .15s ease;
  }
  .card:hover{border-color:var(--border); transform:translateY(-2px); box-shadow:var(--shadow-lift);}
  .card-top{display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:26px;}
  .file-ic{
    width:38px;height:38px; border-radius:8px; background:var(--surface-2); border:1px solid var(--border-soft);
    display:flex; align-items:center; justify-content:center; color:var(--brass);
  }
  .file-ic svg{width:18px;height:18px;}
  .badge{
    font-size:10.5px; font-weight:700; padding:3px 9px; border-radius:999px; letter-spacing:0.3px;
  }
  .badge.ok{background:var(--ok-bg); color:var(--ok);}
  .badge.warn{background:var(--warn-bg); color:var(--warn);}
  .badge.bad{background:var(--bad-bg); color:var(--bad);}
  .card-name{font-size:14px; font-weight:600; margin-bottom:8px; line-height:1.3; word-break:break-word;}
  .card-meta{display:flex; gap:6px; align-items:center; flex-wrap:wrap;}
  .tag{font-size:10.5px; font-weight:600; color:var(--text-faint); background:var(--surface-2); border:1px solid var(--border-soft); padding:2px 7px; border-radius:4px;}
  .tag.cat{color:var(--text-dim);}

  .empty{
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:70px 20px; text-align:center; color:var(--text-dim);
    border:1px dashed var(--border); border-radius:var(--radius-l); margin-top:10px;
  }
  .empty svg{width:36px;height:36px; color:var(--text-faint); margin-bottom:14px;}
  .empty h3{margin:0 0 6px 0; font-size:16px; font-weight:600; color:var(--text);}
  .empty p{margin:0 0 18px 0; font-size:13.5px; max-width:320px;}

  /* ---------- Modal ---------- */
  .overlay{
    display:none; position:fixed; inset:0; background:rgba(6,7,7,0.6);
    align-items:center; justify-content:center; z-index:50; padding:20px;
    backdrop-filter:blur(2px);
  }
  .overlay.show{display:flex;}
  .modal{
    background:var(--surface); border:1px solid var(--border-soft); border-radius:var(--radius-l);
    width:100%; max-width:440px; max-height:88vh; overflow-y:auto;
    box-shadow:var(--shadow-lift);
    animation:modalIn 0.25s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes modalIn{
    from{ opacity:0; transform:scale(0.96) translateY(8px); }
    to{ opacity:1; transform:scale(1) translateY(0); }
  }
  .modal-head{display:flex; align-items:center; justify-content:space-between; padding:20px 22px 6px 22px;}
  .modal-head h2{font-size:18px; font-weight:600; margin:0;}
  .icon-btn{width:28px;height:28px; border-radius:7px; border:none; background:transparent; color:var(--text-faint); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .12s ease, color .12s ease;}
  .icon-btn:hover{background:var(--surface-2); color:var(--text);}
  .modal-body{padding:14px 22px 22px 22px;}
  .field{margin-bottom:16px;}
  .field label{display:block; font-size:12.5px; font-weight:600; color:var(--text-dim); margin-bottom:7px;}
  .field-hint{font-size:11.5px; color:var(--text-faint); margin-top:6px;}
  textarea{resize:vertical; min-height:64px;}
  .file-drop{
    border:1.5px dashed var(--border); border-radius:var(--radius-s); padding:18px; text-align:center;
    cursor:pointer; color:var(--text-dim); font-size:13px; position:relative;
    transition:border-color .15s ease;
  }
  .file-drop:hover{border-color:var(--brass-dim);}
  .file-drop input[type=file]{position:absolute; inset:0; opacity:0; cursor:pointer;}
  .file-preview{display:flex; align-items:center; gap:10px; margin-top:10px; padding:9px 11px; background:var(--surface-2); border-radius:var(--radius-s); border:1px solid var(--border-soft);}
  .file-preview img{width:34px;height:34px; object-fit:cover; border-radius:5px;}
  .file-preview .fp-ic{width:34px;height:34px; border-radius:5px; background:var(--surface-3); display:flex; align-items:center; justify-content:center; color:var(--brass);}
  .file-preview .fp-name{font-size:12.5px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
  .file-preview .fp-remove{cursor:pointer; color:var(--text-faint); font-size:12px; transition:color .12s ease;}
  .file-preview .fp-remove:hover{color:var(--bad);}
  .modal-foot{display:flex; gap:10px; padding:4px 22px 22px 22px;}
  .modal-foot .btn{flex:1;}
  .danger-zone{border-top:1px solid var(--border-soft); margin-top:4px; padding-top:16px;}
  .btn-danger-text{background:transparent; border:1px solid var(--bad); color:var(--bad);}
  .btn-danger-text:hover{background:var(--bad-bg);}

  /* Detail modal */
  .detail-file{
    width:100%; border-radius:var(--radius-m); margin-bottom:16px; overflow:hidden;
    background:var(--surface-2); border:1px solid var(--border-soft);
    display:flex; align-items:center; justify-content:center; min-height:120px;
  }
  .detail-file img{width:100%; max-height:260px; object-fit:contain; display:block;}
  .detail-file .fp-ic{width:52px;height:52px;}
  .detail-row{display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-soft); font-size:13px;}
  .detail-row:last-child{border-bottom:none;}
  .detail-row .k{color:var(--text-faint);}
  .detail-row .v{font-weight:500; text-align:right;}
  .detail-notes{margin-top:6px; font-size:13px; color:var(--text-dim); line-height:1.5; white-space:pre-wrap;}

  .toast{
    position:fixed; bottom:22px; left:50%; transform:translateX(-50%) translateY(20px);
    background:var(--surface-3); border:1px solid var(--border); color:var(--text);
    padding:11px 18px; border-radius:var(--radius-s); font-size:13px; z-index:100;
    opacity:0; transition:opacity .2s ease, transform .2s ease; box-shadow:var(--shadow-lift);
    display:flex; align-items:center; gap:8px;
  }
  .toast.show{opacity:1; transform:translateX(-50%) translateY(0);}
  .toast .dot{width:6px;height:6px;border-radius:50%; background:var(--ok);}

  .main-header-actions{display:flex; align-items:center; gap:8px;}
  .platform-pill{
    font-size:9.5px; font-weight:700; letter-spacing:0.8px;
    background:rgba(224, 182, 100, 0.15); color:var(--brass);
    border:1px solid rgba(224, 182, 100, 0.3);
    padding:2px 6px; border-radius:4px; margin-left:8px;
    vertical-align:middle; text-transform:uppercase;
  }

  /* Safe Area variables */
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
    --sar: env(safe-area-inset-right, 0px);
  }

  @media (max-width: 780px){
    .app-shell{flex-direction:column; min-height:100vh;}
    .sidebar{
      width:100%; min-height:auto; border-right:none; border-bottom:1px solid var(--border-soft);
      padding:12px 16px; display:flex; flex-direction:column; gap:10px;
      position:sticky; top:0; z-index:20;
      background:var(--surface);
    }
    .sidebar .brand{
      display:flex; align-items:center; justify-content:space-between; width:100%; padding:0;
    }
    .sidebar-foot{
      display:flex; flex-direction:row; align-items:center; gap:8px;
      margin:0; padding:0; border-top:none;
    }
    #category-list{
      display:flex; flex-direction:row; overflow-x:auto; gap:6px;
      padding-bottom:4px; -webkit-overflow-scrolling:touch;
      scrollbar-width:none;
    }
    #category-list::-webkit-scrollbar{display:none;}
    .nav-item{
      flex-shrink:0; padding:6px 12px; border-radius:999px;
      background:var(--surface-2); border:1px solid var(--border-soft);
    }
    .profile-card{display:none;}
    .nav-section-label{display:none;}
    .sidebar-spacer{display:none;}
    .main{padding:16px 14px calc(40px + var(--sab)) 14px;}
    .main-header{flex-direction:column; align-items:stretch; gap:12px;}
    .main-header-actions{display:flex; gap:8px;}
    .main-header-actions .btn{flex:1; justify-content:center;}
    .toolbar{flex-direction:column; align-items:stretch; gap:8px;}
    .search-wrap{max-width:100%; min-width:100%;}
    .grid{grid-template-columns:1fr; gap:10px;}
    .overlay{padding:0; align-items:flex-end;}
    .modal{max-width:100%; border-radius:20px 20px 0 0; max-height:90vh;}
    .gate{padding:16px;}
    .gate-card{max-width:100%;}
    .auth-glass{padding:28px 20px 24px 20px;}
  }

/* ================= CLOUD SYNC & BACKUP STYLES ================= */
.modal-wide { max-width: 560px !important; }

.recover-bar {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
  text-align: center;
}
.recover-trigger-btn {
  background: none;
  border: 1px dashed var(--border);
  color: var(--text-dim);
  font-size: 12.5px;
  padding: 8px 14px;
  border-radius: var(--radius-s);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: all 0.15s ease;
}
.recover-trigger-btn:hover {
  border-color: var(--brass);
  color: var(--brass-bright);
  background: rgba(200, 155, 76, 0.05);
}

.cloud-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: auto;
  background: var(--text-faint);
  display: inline-block;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.cloud-status-dot.connected {
  background: var(--ok);
  box-shadow: 0 0 6px rgba(111, 169, 122, 0.6);
}
.cloud-status-dot.syncing {
  background: var(--warn);
  animation: pulseSync 1s infinite alternate;
}
.cloud-status-dot.disconnected {
  background: var(--text-faint);
}
@keyframes pulseSync {
  from { opacity: 0.4; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1.15); box-shadow: 0 0 8px rgba(208, 163, 74, 0.8); }
}

.cloud-tabs {
  display: flex;
  gap: 8px;
  background: var(--surface-2);
  padding: 4px;
  border-radius: var(--radius-m);
  border: 1px solid var(--border-soft);
  margin-bottom: 20px;
}
.cloud-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: var(--radius-s);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}
.cloud-tab.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  border: 1px solid var(--border-soft);
}
:root[data-theme="light"] .cloud-tab.active {
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.provider-switch-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.provider-pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: var(--radius-s);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-dim);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.provider-pill:hover {
  border-color: var(--border-soft);
  color: var(--text);
}
.provider-pill.active {
  background: var(--surface-3);
  border-color: var(--brass);
  color: var(--brass-bright);
  box-shadow: 0 0 10px rgba(200, 155, 76, 0.15);
}
.btn-test-connection {
  background: none;
  border: 1px solid var(--border);
  color: var(--brass-bright);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: var(--radius-s);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  transition: all 0.15s ease;
}
.btn-test-connection:hover {
  background: rgba(200, 155, 76, 0.08);
  border-color: var(--brass);
}
.storage-persist-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-s);
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 12.5px;
}

.cloud-status-card {
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-m);
  padding: 16px;
  margin-bottom: 16px;
}
.cloud-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.status-indicator-badge {
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(108, 110, 105, 0.15);
  color: var(--text-dim);
}
.status-indicator-badge.ok {
  background: var(--ok-bg);
  color: var(--ok);
}
.status-indicator-badge.warn {
  background: var(--warn-bg);
  color: var(--warn);
}
.status-indicator-badge.bad {
  background: var(--bad-bg);
  color: var(--bad);
}
.status-time {
  font-size: 11.5px;
  color: var(--text-faint);
}
.cloud-status-desc {
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.4;
}

.e2ee-callout {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: rgba(200, 155, 76, 0.08);
  border: 1px solid rgba(200, 155, 76, 0.25);
  border-radius: var(--radius-m);
  padding: 14px;
  margin-bottom: 18px;
}
.e2ee-ic {
  font-size: 20px;
  line-height: 1;
}
.e2ee-callout strong {
  display: block;
  font-size: 13px;
  color: var(--brass-bright);
  margin-bottom: 3px;
}
.e2ee-callout p {
  margin: 0;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.4;
}

.btn-group-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 18px;
}

.setup-details {
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-m);
  padding: 12px 16px;
}
.setup-details summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--brass);
  cursor: pointer;
  user-select: none;
}
.setup-guide-content {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.6;
}
.setup-guide-content ol {
  margin: 0 0 12px 0;
  padding-left: 20px;
}
.setup-guide-content li {
  margin-bottom: 6px;
}
.sql-box-wrap {
  position: relative;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-s);
  padding: 12px;
  margin-top: 8px;
}
.sql-box-wrap pre {
  margin: 0;
  font-family: monospace;
  font-size: 11.5px;
  color: var(--brass-bright);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.btn-copy-sql {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.btn-copy-sql:hover {
  background: var(--brass-dim);
  color: #fff;
}

.backup-info-card {
  display: flex;
  gap: 14px;
  align-items: center;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-m);
  padding: 16px;
  margin-bottom: 16px;
}
.backup-ic {
  font-size: 28px;
}
.file-input-stylish {
  width: 100%;
  font-size: 12px;
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--text);
}


/* Ensure Cloud & Backup button responsiveness */
#sidebar-cloud-item, #top-cloud-btn, .recover-trigger-btn {
  cursor: pointer !important;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
#sidebar-cloud-item *, #top-cloud-btn * {
  pointer-events: none;
}

</style>
    <!-- PWA & Mobile Meta Tags -->
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#0D0F10">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="CipherVault">
    <link rel="apple-touch-icon" href="icon-192.png">
    <link rel="icon" type="image/svg+xml" href="icon.svg">
</head>
<body>

<!-- ============ SIGN UP GATE ============ -->
<div class="gate" id="gate-signup" style="display:none;">
  <div class="gate-card">
    <div class="auth-glass">
      <div class="dial" id="dial-signup"><div class="pin"></div></div>
      <h1>Create your vault</h1>
      <p class="sub">Sign up to keep your important documents safe — everything stays in your browser.</p>

      <div class="auth-tabs">
        <button class="auth-tab active" onclick="showSignup()">Sign Up</button>
        <button class="auth-tab" onclick="showLogin()">Log In</button>
      </div>

      <div class="auth-field">
        <input type="text" id="signup-name" placeholder="Full name" autocomplete="name">
        <svg class="field-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M2 14C2 11.2 4.7 9 8 9C11.3 9 14 11.2 14 14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </div>

      <div class="auth-field">
        <input type="email" id="signup-email" placeholder="Email (optional)" autocomplete="email">
        <svg class="field-icon" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M2 4L8 9L14 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>

      <div class="auth-field">
        <input type="password" id="signup-pass" placeholder="Password" autocomplete="new-password" oninput="updateStrength(this.value)">
        <svg class="field-icon" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.4" stroke="currentColor" stroke-width="1.2"/><path d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V7" stroke="currentColor" stroke-width="1.2"/></svg>
        <button class="pass-toggle" type="button" onclick="togglePassVis(this)" tabindex="-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C2.6 5.3 5.1 3.5 8 3.5C10.9 3.5 13.4 5.3 14.5 8C13.4 10.7 10.9 12.5 8 12.5C5.1 12.5 2.6 10.7 1.5 8Z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>

      <div class="strength-bar" id="strength-bar">
        <div class="strength-seg"></div>
        <div class="strength-seg"></div>
        <div class="strength-seg"></div>
        <div class="strength-seg"></div>
      </div>
      <div class="strength-label" id="strength-label"></div>

      <div class="auth-field" style="margin-top:10px;">
        <input type="password" id="signup-pass-confirm" placeholder="Confirm password" autocomplete="new-password" onkeydown="if(event.key==='Enter')handleSignup()">
        <svg class="field-icon" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.4" stroke="currentColor" stroke-width="1.2"/><path d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V7" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="10.5" r="1" fill="currentColor"/></svg>
        <button class="pass-toggle" type="button" onclick="togglePassVis(this)" tabindex="-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C2.6 5.3 5.1 3.5 8 3.5C10.9 3.5 13.4 5.3 14.5 8C13.4 10.7 10.9 12.5 8 12.5C5.1 12.5 2.6 10.7 1.5 8Z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>

      <button class="btn btn-primary btn-block" id="signup-btn" onclick="handleSignup()">
        <span class="btn-spinner"></span>
        <span class="btn-text">Create account</span>
      </button>
      <div class="gate-error" id="signup-error"></div>

      <div class="hint-row">
        <span>🔒</span>
        <span>Your data never leaves this browser. No server, no cloud — just your device. If you clear browser data, your vault is gone forever.</span>
      </div>
    </div>
  </div>
</div>

<!-- ============ LOG IN GATE ============ -->
<div class="gate" id="gate-login" style="display:none;">
  <div class="gate-card">
    <div class="auth-glass">
      <div class="dial" id="dial-login"><div class="pin"></div></div>
      <h1>Welcome back</h1>
      <p class="sub">Log in to access your document vault.</p>

      <div class="auth-tabs">
        <button class="auth-tab" onclick="showSignup()">Sign Up</button>
        <button class="auth-tab active" onclick="showLogin()">Log In</button>
      </div>

      <div class="auth-field">
        <input type="text" id="login-name" placeholder="Your name" autocomplete="username" onkeydown="if(event.key==='Enter')document.getElementById('login-pass').focus()">
        <svg class="field-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M2 14C2 11.2 4.7 9 8 9C11.3 9 14 11.2 14 14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </div>

      <div class="auth-field">
        <input type="password" id="login-pass" placeholder="Password" autocomplete="current-password" onkeydown="if(event.key==='Enter')handleLogin()">
        <svg class="field-icon" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.4" stroke="currentColor" stroke-width="1.2"/><path d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V7" stroke="currentColor" stroke-width="1.2"/></svg>
        <button class="pass-toggle" type="button" onclick="togglePassVis(this)" tabindex="-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C2.6 5.3 5.1 3.5 8 3.5C10.9 3.5 13.4 5.3 14.5 8C13.4 10.7 10.9 12.5 8 12.5C5.1 12.5 2.6 10.7 1.5 8Z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>

      <div class="remember-row">
        <label class="remember-check">
          <input type="checkbox" id="remember-me" checked>
          Remember me
        </label>
        <a class="forgot-link" onclick="showReset()">Forgot password?</a>
      </div>

      <button class="btn btn-primary btn-block" id="login-btn" onclick="handleLogin()">
        <span class="btn-spinner"></span>
        <span class="btn-text">Log in</span>
      </button>
      <div class="gate-error" id="login-error"></div>

      <div class="gate-foot">
        <span style="color:var(--text-faint);">Don't have an account?</span> <a onclick="showSignup()">Sign up</a>
      </div>
      <div class="recover-bar">
        <button type="button" class="recover-trigger-btn" onclick="openGateRecoverModal()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8a5.5 5.5 0 019.4-3.9L13.5 6M13.5 1.5v4.5H9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M13.5 8a5.5 5.5 0 01-9.4 3.9L2.5 10M2.5 14.5v-4.5H7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Restore from Cloud or .vault Backup
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ============ RESET CONFIRM ============ -->
<div class="gate" id="gate-reset" style="display:none;">
  <div class="gate-card">
    <div class="auth-glass">
      <div class="dial"><div class="pin" style="background:var(--bad); box-shadow:0 0 10px rgba(201,104,79,.6)"></div></div>
      <h1>Reset vault?</h1>
      <p class="sub">This permanently deletes every document, all accounts, and passwords from this browser. This can't be undone.</p>
      <button class="btn btn-block" style="background:var(--bad); color:#fff; margin-bottom:10px;" onclick="handleReset()">Yes, delete everything</button>
      <button class="btn btn-ghost btn-block" onclick="showLogin()">Cancel</button>
    </div>
  </div>
</div>

<!-- ============ APP ============ -->
<div id="app">
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="13" r="12" stroke="var(--brass)" stroke-width="1.4"/>
        <circle cx="13" cy="13" r="7.5" stroke="var(--border)" stroke-width="1"/>
        <circle cx="13" cy="13" r="1.8" fill="var(--brass)"/>
        <rect x="12.3" y="2.5" width="1.4" height="5" rx="0.7" fill="var(--brass)"/>
      </svg>
      <span class="brand-name">Keepsafe</span>
    </div>

    <div class="profile-card">
      <div class="avatar" id="avatar-initials">Y</div>
      <div class="profile-meta">
        <div class="profile-name" id="profile-name">Your vault</div>
        <div class="profile-sub"><span id="profile-filecount">0</span> files · <span id="profile-lockstate">🔓 Unlocked</span></div>
        <div class="fill-bar"><div class="fill-bar-in" id="fill-bar" style="width:0%"></div></div>
      </div>
    </div>

    <div class="nav-item active" data-cat="__all__" onclick="setCategory('__all__')">
      <span class="nav-ic" id="ic-all"></span>
      <span class="nav-label">All Documents</span>
      <span class="nav-count" id="count-all">0</span>
    </div>

    <div class="nav-section-label">CATEGORIES</div>
    <div id="category-list"></div>

    <div class="sidebar-spacer"></div>
    <div class="sidebar-foot">
      <div class="nav-item" id="sidebar-install-item" style="display:none;" onclick="triggerPwaInstall()">
        <span class="nav-ic">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V11M8 11L4.5 7.5M8 11L11.5 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 13.5H13.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </span>
        <span class="nav-label">Install App</span>
      </div>
      <div class="nav-item" id="sidebar-cloud-item" onclick="openCloudModal()">
        <span class="nav-ic">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.5 13H12a3 3 0 001-5.83 4.5 4.5 0 00-8.5-1.17A3 3 0 004.5 13z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="nav-label">Cloud & Backup</span>
        <span class="cloud-status-dot disconnected" id="cloud-status-dot" title="Cloud status"></span>
      </div>
      <div class="nav-item" onclick="toggleTheme()">
        <span class="nav-ic" id="ic-theme"></span>
        <span class="nav-label" id="theme-label">Light mode</span>
      </div>
      <div class="nav-item" onclick="lockVault()">
        <span class="nav-ic" id="ic-lock"></span>
        <span class="nav-label">Log out</span>
      </div>
    </div>
  </aside>

  <main class="main">
    <div class="main-header">
      <div>
        <h1 class="main-title" id="view-title">All Documents</h1>
        <p class="main-sub" id="view-sub">0 files</p>
      </div>
      <div class="main-header-actions">
        <button class="btn btn-ghost" id="pwa-install-btn" style="display:none;" onclick="triggerPwaInstall()">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2V11M8 11L4.5 7.5M8 11L11.5 7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 13.5H13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Install App
        </button>
        <button class="btn btn-ghost" id="top-cloud-btn" onclick="openCloudModal()" title="Cloud Connection & Backup">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4.5 13H12a3 3 0 001-5.83 4.5 4.5 0 00-8.5-1.17A3 3 0 004.5 13z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span id="top-cloud-text">Cloud & Backup</span>
        </button>
        <button class="btn btn-primary" onclick="openAddModal()">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2.5V12.5M2.5 7.5H12.5" stroke="#191307" stroke-width="1.6" stroke-linecap="round"/></svg>
          Add Document
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-wrap">
        <svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M14 14L18 18" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <input type="text" id="search-input" placeholder="Search name, category, or notes..." oninput="render()">
      </div>
      <div class="chip active" data-status="__all__" onclick="setStatusFilter('__all__')">All</div>
      <div class="chip" data-status="active" onclick="setStatusFilter('active')"><span class="dot" style="background:var(--ok)"></span>Active</div>
      <div class="chip" data-status="expiring" onclick="setStatusFilter('expiring')"><span class="dot" style="background:var(--warn)"></span>Expiring</div>
      <div class="chip" data-status="expired" onclick="setStatusFilter('expired')"><span class="dot" style="background:var(--bad)"></span>Expired</div>
    </div>

    <div class="grid" id="doc-grid"></div>
    <div class="empty" id="empty-state" style="display:none;"></div>
  </main>
</div>
</div>

<!-- ============ ADD/EDIT MODAL ============ -->
<div class="overlay" id="doc-overlay" onclick="if(event.target===this) closeDocModal()">
  <div class="modal">
    <div class="modal-head">
      <h2 id="doc-modal-title">Add Document</h2>
      <button class="icon-btn" onclick="closeDocModal()" id="ic-close-doc"></button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Document name</label>
        <input type="text" id="f-name" placeholder="e.g. Passport 2024.pdf">
      </div>
      <div class="field">
        <label>Category</label>
        <select id="f-category"></select>
      </div>
      <div class="field">
        <label>Expiry date (optional)</label>
        <input type="date" id="f-expiry">
        <div class="field-hint">Leave blank for documents that don't expire.</div>
      </div>
      <div class="field">
        <label>File (optional)</label>
        <div class="file-drop" id="file-drop-zone">
          <span id="file-drop-label">Click to upload a file, or drop it here</span>
          <input type="file" id="f-file" onchange="handleFileSelect(event)">
        </div>
        <div class="file-preview" id="file-preview-box" style="display:none;"></div>
        <div class="field-hint">Stored locally & securely via IndexedDB (supports high capacity & large files up to ~50MB).</div>
      </div>
      <div class="field">
        <label>Notes (optional)</label>
        <textarea id="f-notes" placeholder="Policy number, document ID, reminders..."></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeDocModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveDocument()">Save document</button>
    </div>
  </div>
</div>

<!-- ============ DETAIL MODAL ============ -->
<div class="overlay" id="detail-overlay" onclick="if(event.target===this) closeDetailModal()">

<!-- Fullscreen In-App File Preview Lightbox -->
<div class="overlay" id="preview-lightbox" style="z-index: 2000;" onclick="if(event.target===this) closeFullscreenPreview();">
  <div style="position:relative; width:94vw; max-width:1200px; height:88vh; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-l); display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow-lift);">
    <div style="padding:12px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:var(--surface-2);">
      <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
        <span id="lightbox-icon" style="display:inline-flex; align-items:center;"></span>
        <h3 id="lightbox-title" style="margin:0; font-size:16px; font-family:'Fraunces', serif; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Document Preview</h3>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <button class="btn btn-ghost" onclick="downloadCurrentDoc()" style="font-size:13px; padding:6px 14px;">⬇ Download</button>
        <button class="icon-btn" onclick="closeFullscreenPreview()" title="Close (ESC)" style="font-size:16px; width:34px; height:34px;">✕</button>
      </div>
    </div>
    <div id="lightbox-body" style="flex:1; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#0B0D0E; overflow:hidden; padding:12px; position:relative;">
      <!-- Dynamic preview injected here -->
    </div>
  </div>
</div>

  <div class="modal">
    <div class="modal-head">
      <h2 id="detail-title">Document</h2>
      <button class="icon-btn" onclick="closeDetailModal()" id="ic-close-detail"></button>
    </div>
    <div class="modal-body">
      <div class="detail-file" id="detail-file"></div>
      <div class="detail-row"><span class="k">Category</span><span class="v" id="detail-category">—</span></div>
      <div class="detail-row"><span class="k">Status</span><span class="v" id="detail-status">—</span></div>
      <div class="detail-row"><span class="k">Expires</span><span class="v" id="detail-expiry">—</span></div>
      <div class="detail-row"><span class="k">Added</span><span class="v" id="detail-added">—</span></div>
      <div id="detail-notes-wrap" style="display:none;">
        <div class="detail-row"><span class="k">Notes</span><span></span></div>
        <div class="detail-notes" id="detail-notes"></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-primary" id="detail-view" onclick="viewCurrentDoc()" style="margin-right:auto;">Open / View</button>
      <button class="btn btn-ghost" id="detail-download" onclick="downloadCurrentDoc()">Download</button>
      <button class="btn btn-ghost" onclick="editCurrentDoc()">Edit</button>
      <button class="btn btn-danger-text" onclick="deleteCurrentDoc()">Delete</button>
    </div>
  </div>
</div>


<!-- ============ GATE RECOVERY MODAL ============ -->
<div class="overlay" id="gate-recover-overlay" onclick="if(event.target===this) closeGateRecoverModal()">
  <div class="modal modal-wide">
    <div class="modal-head">
      <div>
        <h2 style="font-size:18px;">Restore Vault Data (Recovery)</h2>
        <div style="font-size:12px; color:var(--text-dim); margin-top:3px;">Recover your files if browser cache was cleared or when moving to a new device</div>
      </div>
      <button class="icon-btn" onclick="closeGateRecoverModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="cloud-tabs">
        <button class="cloud-tab active" id="tab-btn-rec-file" onclick="switchRecTab('file')">📦 From .vault Backup File</button>
        <button class="cloud-tab" id="tab-btn-rec-cloud" onclick="switchRecTab('cloud')">☁️ From Cloud (Cloudflare / Supabase)</button>
      </div>

      <!-- Recover via File -->
      <div id="rec-tab-file">
        <p style="font-size:13px; color:var(--text-dim); margin-bottom:14px; line-height:1.5;">
          Select your exported <code>.vault</code> backup file and enter your password to restore your documents and account.
        </p>
        <div class="field">
          <label>Select .vault Backup File</label>
          <input type="file" id="rec-file-input" accept=".vault,.json" class="file-input-stylish">
        </div>
        <div class="field">
          <label>Vault Password</label>
          <div class="pass-wrap">
            <input type="password" id="rec-file-pass" placeholder="Enter your vault password">
            <button type="button" class="pass-toggle" onclick="togglePassVis(this)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C2.6 5.3 5.1 3.5 8 3.5C10.9 3.5 13.4 5.3 14.5 8C13.4 10.7 10.9 12.5 8 12.5C5.1 12.5 2.6 10.7 1.5 8Z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 13.5L13.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div id="rec-file-error" class="gate-error" style="margin-bottom:12px;"></div>
        <button class="btn btn-primary btn-block" id="rec-file-btn" onclick="executeFileRecovery()">
          <span class="btn-spinner"></span>
          <span class="btn-text">Restore Vault</span>
        </button>
      </div>

      <!-- Recover via Cloud -->
      <div id="rec-tab-cloud" style="display:none;">
        <p style="font-size:13px; color:var(--text-dim); margin-bottom:12px; line-height:1.5;">
          Connect to your Cloudflare Worker or Supabase to download and decrypt your synced vault data.
        </p>

        <div class="provider-switch-row" style="margin-bottom:14px;">
          <button type="button" class="provider-pill active" id="rec-prov-cf" onclick="switchRecProvider('cloudflare')">
            <span>☁️ Cloudflare</span>
          </button>
          <button type="button" class="provider-pill" id="rec-prov-sb" onclick="switchRecProvider('supabase')">
            <span>⚡ Supabase</span>
          </button>
        </div>

        <!-- Cloudflare Recovery Fields -->
        <div id="rec-fields-cf">
          <div class="field">
            <label>Cloudflare Worker URL</label>
            <input type="text" id="rec-cf-url" placeholder="https://keepsafe-vault.yourname.workers.dev">
          </div>
          <div class="field">
            <label>Sync Secret Token (Optional)</label>
            <input type="password" id="rec-cf-token" placeholder="Opsyonal: secret key">
          </div>
        </div>

        <!-- Supabase Recovery Fields -->
        <div id="rec-fields-sb" style="display:none;">
          <div class="field">
            <label>Supabase Project URL</label>
            <input type="text" id="rec-cloud-url" placeholder="https://xxxxxxxx.supabase.co">
          </div>
          <div class="field">
            <label>Supabase Anon Public Key</label>
            <input type="password" id="rec-cloud-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6...">
          </div>
        </div>

        <div class="field">
          <label>Username / Account Name</label>
          <input type="text" id="rec-cloud-user" placeholder="Username used in vault">
        </div>
        <div class="field">
          <label>Vault Password</label>
          <div class="pass-wrap">
            <input type="password" id="rec-cloud-pass" placeholder="Your vault password">
            <button type="button" class="pass-toggle" onclick="togglePassVis(this)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C2.6 5.3 5.1 3.5 8 3.5C10.9 3.5 13.4 5.3 14.5 8C13.4 10.7 10.9 12.5 8 12.5C5.1 12.5 2.6 10.7 1.5 8Z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 13.5L13.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div id="rec-cloud-error" class="gate-error" style="margin-bottom:12px;"></div>
        <button class="btn btn-primary btn-block" id="rec-cloud-btn" onclick="executeCloudRecovery()">
          <span class="btn-spinner"></span>
          <span class="btn-text">Download and Restore from Cloud</span>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ============ CLOUD & BACKUP MODAL ============ -->
<div class="overlay" id="cloud-overlay" onclick="if(event.target===this) closeCloudModal()">
  <div class="modal modal-wide">
    <div class="modal-head">
      <div>
        <h2>Cloud Sync & Backup Vault</h2>
        <div style="font-size:12px; color:var(--text-dim); margin-top:3px;">Permanent cloud protection and automatic sync even across devices</div>
      </div>
      <button class="icon-btn" onclick="closeCloudModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="cloud-tabs">
        <button class="cloud-tab active" id="tab-btn-sync" onclick="switchCloudTab('sync')">☁️ Cloud Auto-Sync</button>
        <button class="cloud-tab" id="tab-btn-file" onclick="switchCloudTab('file')">📦 One-Click .vault Backup</button>
      </div>

      <!-- Cloud Sync Tab -->
      <div id="cloud-tab-sync">
        <div class="cloud-status-card">
          <div class="cloud-status-header">
            <span class="status-indicator-badge" id="cloud-status-badge">● Not Connected</span>
            <span class="status-time" id="cloud-last-sync-time">Last sync: Never</span>
          </div>
          <div class="cloud-status-desc" id="cloud-status-desc">
            Connect to Cloudflare Worker or Supabase to automatically keep your documents backed up in the cloud.
          </div>
        </div>

        <div class="storage-persist-card">
          <div>
            <strong style="color:var(--text); display:block; margin-bottom:2px;">🛡️ Browser Storage Persistence</strong>
            <span id="storage-persist-text" style="color:var(--text-dim); font-size:12px;">Prevents the browser from automatically evicting your local cache</span>
          </div>
          <button type="button" class="btn btn-ghost" id="btn-request-persist" onclick="enableStoragePersistence()" style="font-size:12px; padding:5px 10px;">
            Enable Persistence
          </button>
        </div>

        <div class="e2ee-callout">
          <div class="e2ee-ic">🔒</div>
          <div>
            <strong>End-to-End Encrypted (AES-GCM 256-bit)</strong>
            <p>All files are encrypted client-side using your password before leaving your browser. Even Cloudflare cannot read your data.</p>
          </div>
        </div>

        <!-- Provider Switcher -->
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dim); margin-bottom:6px;">SELECT CLOUD PROVIDER</label>
        <div class="provider-switch-row">
          <button type="button" class="provider-pill active" id="prov-btn-cf" onclick="switchCloudProvider('cloudflare')">
            <span>☁️ Cloudflare Workers KV</span>
          </button>
          <button type="button" class="provider-pill" id="prov-btn-sb" onclick="switchCloudProvider('supabase')">
            <span>⚡ Supabase Database</span>
          </button>
        </div>

        <!-- Cloudflare Provider Settings -->
        <div id="provider-section-cf">
          <div class="field">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label>Cloudflare Worker URL</label>
              <button type="button" class="btn-test-connection" id="btn-test-cf" onclick="testCloudflareConnection()">
                <span class="btn-spinner"></span>
                <span>Test Connection</span>
              </button>
            </div>
            <input type="text" id="cfg-cf-url" placeholder="https://keepsafe-vault.yourname.workers.dev">
            <div class="field-hint">Your free Cloudflare Worker endpoint that receives encrypted vault data.</div>
          </div>

          <div class="field">
            <label>Sync Secret Token <span style="color:var(--text-faint); font-weight:normal;">(Opsyonal / Dagdag Seguridad)</span></label>
            <input type="password" id="cfg-cf-token" placeholder="Halimbawa: my-private-vault-token-123">
          </div>
        </div>

        <!-- Supabase Provider Settings -->
        <div id="provider-section-sb" style="display:none;">
          <div class="field">
            <label>Supabase Project URL</label>
            <input type="text" id="cfg-cloud-url" placeholder="https://xxxxxxxxxxxx.supabase.co">
          </div>

          <div class="field">
            <label>Supabase Public Anon Key</label>
            <input type="password" id="cfg-cloud-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">
          </div>
        </div>

        <div class="remember-row" style="margin-bottom:10px;">
          <label class="remember-check">
            <input type="checkbox" id="cfg-cloud-autosync" checked>
            Auto-sync when adding, editing, or deleting files
          </label>
        </div>

        <div class="remember-row" style="margin-bottom:18px;">
          <label class="remember-check">
            <input type="checkbox" id="cfg-cloud-reopen-sync" checked>
            Auto-sync on app open (Download latest version)
          </label>
        </div>

        <div class="btn-group-row">
          <button class="btn btn-primary" id="btn-save-cloud-cfg" onclick="saveCloudSettingsAndSync()">
            <span class="btn-spinner"></span>
            <span class="btn-text">Save & Sync Now</span>
          </button>
          <button class="btn btn-ghost" id="btn-pull-cloud" onclick="pullFromCloudManual()">
            <span class="btn-spinner"></span>
            <span class="btn-text">Restore from Cloud</span>
          </button>
          <button class="btn btn-danger-text" id="btn-disconnect-cloud" onclick="disconnectCloud()" style="margin-left:auto;">
            Disconnect
          </button>
        </div>

        <!-- Cloudflare Setup Guide Collapsible -->
        <details class="setup-details" id="setup-guide-cf" style="margin-top:20px;" open>
          <summary>☁️ How to setup Cloudflare Worker (Free, 2 minutes)</summary>
          <div class="setup-guide-content">
            <ol>
              <li>Go to <a href="https://dash.cloudflare.com" target="_blank" rel="noopener" style="color:var(--brass-bright); text-decoration:underline;">dash.cloudflare.com</a> and sign in / sign up for free.</li>
              <li>Click <strong>Workers & Pages</strong> &gt; <strong>Create application</strong> &gt; <strong>Create Worker</strong>.</li>
              <li>Name it (e.g. <code>keepsafe-vault</code>) and click <strong>Deploy</strong>.</li>
              <li>Click <strong>Edit code</strong>, clear default code, and paste the Cloudflare Worker code below:</li>
            </ol>
            <div class="sql-box-wrap" style="margin-bottom:12px;">
              <button class="btn-copy-sql" onclick="copyWorkerCode()" style="position:relative; right:auto; top:auto; width:100%; padding:10px; font-size:13px; margin-bottom:8px;">
                📋 Copy Complete Cloudflare Worker Code
              </button>
              <pre id="cf-worker-code-preview" style="max-height:160px; overflow-y:auto; font-size:11px;">// Cloudflare Worker for Keepsafe Vault Sync
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Secret',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'Keepsafe Vault' }), { headers: cors });
    }
    if (url.pathname === '/api/vault') {
      if (request.method === 'GET') {
        const uid = url.searchParams.get('user_id');
        const data = env.VAULT_KV ? await env.VAULT_KV.get('vault:' + uid) : null;
        if (!data) return new Response(JSON.stringify({ found: false }), { headers: cors });
        return new Response(JSON.stringify({ found: true, encrypted_data: JSON.parse(data) }), { headers: cors });
      }
      if (request.method === 'POST') {
        const { user_id, encrypted_data } = await request.json();
        if (env.VAULT_KV) await env.VAULT_KV.put('vault:' + user_id, JSON.stringify(encrypted_data));
        return new Response(JSON.stringify({ success: true }), { headers: cors });
      }
    }
    return new Response('Keepsafe Worker Online', { headers: cors });
  }
};</pre>
            </div>
            <ol start="5">
              <li>Click <strong>Save and Deploy</strong> in the Cloudflare editor.</li>
              <li><em>(For persistent storage)</em>: Under Worker &gt; <strong>Settings</strong> &gt; <strong>Bindings</strong> &gt; Bind a KV namespace named <code>VAULT_KV</code>.</li>
              <li>Copy the worker URL (e.g. <code>https://keepsafe-vault.yourname.workers.dev</code>) and paste above!</li>
            </ol>
          </div>
        </details>

        <!-- Supabase Setup Guide Collapsible -->
        <details class="setup-details" id="setup-guide-sb" style="margin-top:14px; display:none;">
          <summary>📖 How to get a free Supabase URL & Key</summary>
          <div class="setup-guide-content">
            <ol>
              <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener" style="color:var(--brass-bright); text-decoration:underline;">supabase.com</a> and sign up for free.</li>
              <li>Click <strong>"New Project"</strong> and set a database password.</li>
              <li>Go to <strong>Project Settings > API</strong> and copy the <code>Project URL</code> and <code>anon / public key</code>.</li>
              <li>Go to <strong>SQL Editor</strong> in Supabase and run this code to create the vault table:</li>
            </ol>
            <div class="sql-box-wrap">
              <pre id="supabase-sql-code">CREATE TABLE IF NOT EXISTS keepsafe_vault (
  user_id TEXT PRIMARY KEY,
  encrypted_data TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE keepsafe_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon access" ON keepsafe_vault FOR ALL USING (true) WITH CHECK (true);</pre>
              <button class="btn-copy-sql" onclick="copySqlCode()">Copy SQL</button>
            </div>
          </div>
        </details>
      </div>

      <!-- File Backup Tab -->
      <div id="cloud-tab-file" style="display:none;">
        <div class="backup-info-card">
          <div class="backup-ic">📦</div>
          <div>
            <h4 style="margin:0 0 4px 0; font-size:15px; color:var(--text);">One-Click Encrypted Backup (.vault)</h4>
            <p style="margin:0; font-size:13px; color:var(--text-dim); line-height:1.4;">
              Download a standalone backup file containing all your documents, pictures, and accounts. Fully encrypted using your password.
            </p>
          </div>
        </div>

        <div style="background:var(--surface-2); border:1px solid var(--border-soft); border-radius:var(--radius-m); padding:16px; margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <strong style="font-size:13.5px; display:block;">Export Backup File</strong>
              <span style="font-size:12px; color:var(--text-dim);">Save to Google Drive, OneDrive, iCloud, or a USB flash drive</span>
            </div>
            <button class="btn btn-primary" onclick="exportVaultBackupFile()">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:-2px; margin-right:4px;"><path d="M8 2v9M8 11l-3.5-3.5M8 11l3.5-3.5M2.5 13.5h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
              Download .vault Backup
            </button>
          </div>
        </div>

        <div style="background:var(--surface-2); border:1px solid var(--border-soft); border-radius:var(--radius-m); padding:16px;">
          <strong style="font-size:13.5px; display:block; margin-bottom:4px;">Restore Vault from Backup File</strong>
          <span style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:12px;">Reload your previously saved backup files</span>
          <div class="field" style="margin-bottom:10px;">
            <input type="file" id="modal-restore-file" accept=".vault,.json" class="file-input-stylish">
          </div>
          <div class="field" style="margin-bottom:12px;">
            <label>Enter your Vault Password to decrypt</label>
            <input type="password" id="modal-restore-pass" placeholder="Vault password">
          </div>
          <button class="btn btn-ghost" id="modal-restore-btn" onclick="executeModalFileRestore()">
            <span class="btn-spinner"></span>
            <span class="btn-text">Restore Documents</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"><span class="dot"></span><span id="toast-text"></span></div>


    <script>
/* ================= TOAST NOTIFICATION SYSTEM ================= */
let toastTimer = null;
function showToast(msg, isErr = false){
  const t = document.getElementById('toast');
  const txt = document.getElementById('toast-text');
  if(!t || !txt) return;
  txt.textContent = msg;
  const dot = t.querySelector('.dot');
  if(dot){
    dot.style.background = isErr ? 'var(--bad, #C9684F)' : 'var(--ok, #6FA97A)';
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, 2800);
}
function renderAll(){
  if(typeof render === 'function') render();
}

/* ================= ICONS ================= */
const ICONS = {
  all: '<svg viewBox="0 0 16 16" fill="none"><path d="M2 4.5C2 3.67 2.67 3 3.5 3H6.5L8 4.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" stroke="currentColor" stroke-width="1.3"/></svg>',
  passport: '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 2C9.5 3.8 9.5 12.2 8 14M8 2C6.5 3.8 6.5 12.2 8 14M2.3 6H13.7M2.3 10H13.7" stroke="currentColor" stroke-width="1"/></svg>',
  license: '<svg viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.4" stroke="currentColor" stroke-width="1.2"/><circle cx="5" cy="8" r="1.4" stroke="currentColor" stroke-width="1"/><path d="M9 6.5H12.5M9 8H12.5M9 9.5H11" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
  birth: '<svg viewBox="0 0 16 16" fill="none"><path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M10 2V5H13" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.5 8.5H10.5M5.5 10.5H10.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
  insurance: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5L13.5 3.5V7.5C13.5 11 11 13.5 8 14.5C5 13.5 2.5 11 2.5 7.5V3.5L8 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  medical: '<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M8 5V11M5 8H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  property: '<svg viewBox="0 0 16 16" fill="none"><path d="M2 7.5L8 2L14 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 6.5V13.5H12.5V6.5" stroke="currentColor" stroke-width="1.2"/><rect x="6.7" y="9" width="2.6" height="4.5" stroke="currentColor" stroke-width="1"/></svg>',
  other: '<svg viewBox="0 0 16 16" fill="none"><path d="M3 2H9L13 6V14H3V2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 2V6H13" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  pdf: '<svg viewBox="0 0 16 16" fill="none"><path d="M3 2H9L13 6V14H3V2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 2V6H13" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  img: '<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.4" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="6.5" r="1.3" stroke="currentColor" stroke-width="1"/><path d="M3 12L6.5 8.5L9 11L11.5 8L13.5 10.5" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>',
  theme: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.5 3.5L11.4 4.6M4.6 11.4L3.5 12.5M12.5 12.5L11.4 11.4M4.6 4.6L3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.2"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.4" stroke="currentColor" stroke-width="1.2"/><path d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V7" stroke="currentColor" stroke-width="1.2"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  logout: '<svg viewBox="0 0 16 16" fill="none"><path d="M6 2H3.5C2.67 2 2 2.67 2 3.5V12.5C2 13.33 2.67 14 3.5 14H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M11 11L14 8L11 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 8H14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'
};

const CATEGORIES = [
  {id:'passport', label:"Passport", icon:ICONS.passport},
  {id:'license', label:"Driver's License", icon:ICONS.license},
  {id:'birth', label:"Birth Certificate", icon:ICONS.birth},
  {id:'insurance', label:"Insurance", icon:ICONS.insurance},
  {id:'medical', label:"Medical Records", icon:ICONS.medical},
  {id:'property', label:"Property", icon:ICONS.property},
  {id:'other', label:"Other", icon:ICONS.other},
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));
function getCatLabel(catId){
  return (CAT_MAP[catId] && CAT_MAP[catId].label) || catId || 'General';
}
function getCatIcon(catId){
  return (CAT_MAP[catId] && CAT_MAP[catId].icon) || ICONS.folder || '';
}

const LS_USERS = 'keepsafe_users_v2';
const LS_THEME = 'keepsafe_theme_v1';
const LS_SESSION = 'keepsafe_session_v2';
const LS_REMEMBER = 'keepsafe_remember_v1';

/* ================= INDEXEDDB STORAGE (HIGH CAPACITY) ================= */
const DB_NAME = 'KeepsafeVaultDB_v1';
const DB_VERSION = 1;
const DB_STORE = 'documents';
let dbPromise = null;

function openVaultDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(DB_STORE)){
        const store = db.createObjectStore(DB_STORE, { keyPath: 'id' });
        store.createIndex('userKey', 'userKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.error('IndexedDB open error:', req.error);
      reject(req.error);
    };
  });
  return dbPromise;
}

async function dbGetAllDocs(userK){
  try{
    const db = await openVaultDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const index = store.index('userKey');
      const req = index.getAll(userK);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }catch(err){
    console.warn('Falling back from IndexedDB:', err);
    return null;
  }
}

async function dbPutDoc(doc){
  try{
    const db = await openVaultDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      store.put(doc);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }catch(err){
    console.error('IndexedDB put error:', err);
    return false;
  }
}

async function dbDeleteDoc(id){
  try{
    const db = await openVaultDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }catch(err){
    console.error('IndexedDB delete error:', err);
    return false;
  }
}


/* Reconcile local database with authoritative cloud docs (purges deleted files) */
async function reconcileWithCloudDocs(userK, cloudDocs){
  if(!Array.isArray(cloudDocs)) return;
  const localDocs = await dbGetAllDocs(userK) || [];
  const cloudDocIds = new Set(cloudDocs.map(function(d){ return d.id; }));
  for(let i = 0; i < localDocs.length; i++){
    const local = localDocs[i];
    if(!cloudDocIds.has(local.id)){
      console.log('Purging deleted file from local DB:', local.id, local.name);
      await dbDeleteDoc(local.id);
    }
  }
  for(let j = 0; j < cloudDocs.length; j++){
    const doc = cloudDocs[j];
    doc.userKey = userK;
    await dbPutDoc(doc);
  }
  state.docs = cloudDocs;
  render();
}

async function dbClearAllDocs(){
  try{
    const db = await openVaultDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).clear();
  }catch(e){}
}

let currentUser = null;

let state = {
  category: '__all__',
  status: '__all__',
  docs: [],
  editingId: null,
  detailId: null,
  fileData: null,
};

/* ================= HELPERS ================= */
function getUsers(){
  try{ return JSON.parse(localStorage.getItem(LS_USERS) || '{}'); } catch(e){ return {}; }
}
function saveUsers(users){
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}
function userKey(name){
  return name.trim().toLowerCase();
}

/* ================= INIT ================= */
async function init(){
  document.getElementById('ic-all').innerHTML = ICONS.all;
  document.getElementById('ic-theme').innerHTML = ICONS.theme;
  document.getElementById('ic-lock').innerHTML = ICONS.logout;
  document.getElementById('ic-close-doc').innerHTML = ICONS.close;
  document.getElementById('ic-close-detail').innerHTML = ICONS.close;
  applyTheme();

  const users = getUsers();
  const hasAnyUser = Object.keys(users).length > 0;

  // Check remembered session
  const rememberedKey = localStorage.getItem(LS_REMEMBER);
  const sessionKey = sessionStorage.getItem(LS_SESSION);
  const autoKey = rememberedKey || sessionKey;

  if(autoKey && users[autoKey]){
    currentUser = users[autoKey];
    currentUser._key = autoKey;
    await enterApp();
  } else {
    showLogin();
  }
}

function applyTheme(){
  const t = localStorage.getItem(LS_THEME) || 'dark';
  if(t==='light'){ document.documentElement.setAttribute('data-theme','light'); }
  else { document.documentElement.removeAttribute('data-theme'); }
  const lbl = document.getElementById('theme-label');
  if(lbl) lbl.textContent = t==='light' ? 'Dark mode' : 'Light mode';
}
function toggleTheme(){
  const t = localStorage.getItem(LS_THEME) || 'dark';
  localStorage.setItem(LS_THEME, t==='light' ? 'dark' : 'light');
  applyTheme();
}

/* ================= SCREEN SWITCHING ================= */
function hideAllGates(){
  ['gate-signup','gate-login','gate-reset'].forEach(id=>{
    document.getElementById(id).style.display='none';
  });
  document.getElementById('app').classList.remove('ready');
}

function showSignup(){
  hideAllGates();
  document.getElementById('gate-signup').style.display='flex';
  const card = document.querySelector('#gate-signup .gate-card');
  card.style.animation='none';
  card.offsetHeight;
  card.style.animation='';
  setTimeout(()=>document.getElementById('signup-name').focus(), 100);
}

function showLogin(){
  hideAllGates();
  document.getElementById('gate-login').style.display='flex';
  const card = document.querySelector('#gate-login .gate-card');
  card.style.animation='none';
  card.offsetHeight;
  card.style.animation='';
  setTimeout(()=>document.getElementById('login-name').focus(), 100);
}

function showReset(){
  hideAllGates();
  document.getElementById('gate-reset').style.display='flex';
}

/* ================= AUTH ================= */
async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Password strength
function updateStrength(pass){
  const segs = document.querySelectorAll('#strength-bar .strength-seg');
  const label = document.getElementById('strength-label');
  let score = 0;
  if(pass.length >= 4) score++;
  if(pass.length >= 8) score++;
  if(/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if(/[^a-zA-Z0-9]/.test(pass)) score++;

  const colors = ['var(--bad)','var(--warn)','var(--brass)','var(--ok)'];
  const labels = ['Weak','Fair','Good','Strong'];
  segs.forEach((seg, i) => {
    seg.style.background = i < score ? colors[Math.min(score-1, 3)] : 'var(--surface-3)';
  });
  label.textContent = pass.length > 0 ? labels[Math.min(score-1, 3)] || '' : '';
  label.style.color = pass.length > 0 ? colors[Math.min(score-1, 3)] : 'var(--text-faint)';
}

// Toggle password visibility
function togglePassVis(btn){
  const input = btn.parentElement.querySelector('input');
  if(input.type === 'password'){
    input.type = 'text';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C2.6 5.3 5.1 3.5 8 3.5C10.9 3.5 13.4 5.3 14.5 8C13.4 10.7 10.9 12.5 8 12.5C5.1 12.5 2.6 10.7 1.5 8Z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 13.5L13.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C2.6 5.3 5.1 3.5 8 3.5C10.9 3.5 13.4 5.3 14.5 8C13.4 10.7 10.9 12.5 8 12.5C5.1 12.5 2.6 10.7 1.5 8Z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/></svg>';
  }
}

async function handleSignup(){
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const p1 = document.getElementById('signup-pass').value;
  const p2 = document.getElementById('signup-pass-confirm').value;
  const err = document.getElementById('signup-error');
  const btn = document.getElementById('signup-btn');

  if(!name){ err.textContent = 'Please enter your name.'; return; }
  if(name.length < 2){ err.textContent = 'Name must be at least 2 characters.'; return; }
  if(p1.length < 4){ err.textContent = 'Password must be at least 4 characters.'; return; }
  if(p1 !== p2){ err.textContent = "Passwords do not match."; return; }

  const key = userKey(name);
  const users = getUsers();
  if(users[key]){
    err.textContent = 'An account with this name already exists. Please log in.';
    return;
  }

  err.textContent = '';
  btn.classList.add('loading');

  // Check if account already exists in cloud
  try{
    const cfg = getCloudConfig();
    const existingCloud = await pullFromCloudflare(cfg, key);
    if(existingCloud){
      err.textContent = 'An account with this name already exists in Cloud! Please log in.';
      btn.classList.remove('loading');
      return;
    }
  }catch(e){
    console.log('Pre-signup cloud check note:', e);
  }

  await new Promise(r=>setTimeout(r, 400));

  const hash = await sha256(p1);
  const docsKey = 'keepsafe_docs_' + key;

  users[key] = { name, email, passHash: hash, docsKey, createdAt: new Date().toISOString() };
  try{
    saveUsers(users);
  }catch(e){
    err.textContent = 'Could not save to browser. Check storage permissions.';
    btn.classList.remove('loading');
    return;
  }

  btn.classList.remove('loading');
  document.getElementById('dial-signup').classList.add('spin');

  currentUser = users[key];
  currentUser._key = key;
  sessionStorage.setItem(LS_SESSION, key);

  await new Promise(r=>setTimeout(r, 400));
  await enterApp();
  showToast('Welcome to Keepsafe, ' + name + '!');

  // Automatically sync new account to Cloudflare
  try{
    await syncVaultToCloud(true);
  }catch(e){
    console.warn('Initial cloud signup sync notice:', e);
  }
}

async function handleLogin(){
  const name = document.getElementById('login-name').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const remember = document.getElementById('remember-me').checked;

  if(!name){ err.textContent = 'Please enter your name.'; return; }
  if(!pass){ err.textContent = 'Please enter your password.'; return; }

  const key = userKey(name);
  let users = getUsers();

  // If account does not exist locally -> pull from Cloudflare
  if(!users[key]){
    btn.classList.add('loading');
    err.textContent = 'Verifying account in Cloud...';
    try{
      const cloudCfg = getCloudConfig();
      const resData = await pullFromCloudflare(cloudCfg, key);
      
      if(!resData){
        err.textContent = 'No account found with this name (local or cloud).';
        btn.classList.remove('loading');
        return;
      }

      // Found in Cloud! Decrypt using password
      const rawEncrypted = resData.encrypted_data || resData;
      const hash = await sha256(pass);
      let decrypted;
      try{
        decrypted = await decryptVaultPayload(rawEncrypted, hash);
      }catch(decErr){
        console.warn('Password decryption failed:', decErr);
        err.textContent = 'Incorrect password for this account.';
        btn.classList.remove('loading');
        return;
      }

      // Decryption successful! Save account and docs to browser
      const restoredUser = decrypted.user || {
        name: name,
        passHash: hash,
        docsKey: 'keepsafe_docs_' + key,
        createdAt: new Date().toISOString()
      };
      restoredUser.passHash = hash;
      restoredUser._key = key;

      users = getUsers();
      users[key] = restoredUser;
      saveUsers(users);

      if(Array.isArray(decrypted.docs)){
        for(const doc of decrypted.docs){
          doc.userKey = key;
          await dbPutDoc(doc);
        }
      }

      currentUser = restoredUser;
      sessionStorage.setItem(LS_SESSION, key);
      if(remember) localStorage.setItem(LS_REMEMBER, key);

      btn.classList.remove('loading');
      err.textContent = '';
      await enterApp();
      showToast(\`Welcome back, \${name}! Vault synced from Cloud.\`);
      return;
    }catch(cloudErr){
      console.error('Cloud auto-login error:', cloudErr);
      err.textContent = 'Could not connect to Cloud: ' + (cloudErr.message || cloudErr);
      btn.classList.remove('loading');
      return;
    }
  }

  // If account is already in local storage
  err.textContent = '';
  btn.classList.add('loading');

  await new Promise(r=>setTimeout(r, 400));

  const hash = await sha256(pass);
  if(hash !== users[key].passHash){
    err.textContent = 'Incorrect password.';
    btn.classList.remove('loading');
    return;
  }

  btn.classList.remove('loading');
  document.getElementById('dial-login').classList.add('spin');

  currentUser = users[key];
  currentUser._key = key;
  sessionStorage.setItem(LS_SESSION, key);

  if(remember){
    localStorage.setItem(LS_REMEMBER, key);
  } else {
    localStorage.removeItem(LS_REMEMBER);
  }

  await new Promise(r=>setTimeout(r, 400));
  await enterApp();
  showToast('Welcome back, ' + currentUser.name + '!');

  // Silently check cloud for new docs from other devices
  try{
    const cfg = getCloudConfig();
    const cloudData = await pullFromCloudflare(cfg, key);
    if(cloudData){
      const rawEnc = cloudData.encrypted_data || cloudData;
      const dec = await decryptVaultPayload(rawEnc, hash);
      if(Array.isArray(dec.docs) && dec.docs.length > 0){
        for(const doc of dec.docs){
          doc.userKey = key;
          await dbPutDoc(doc);
        }
        await loadDocs();
        renderAll();
      }
    }
  }catch(e){
    console.log('Background cloud refresh note:', e);
  }
}

async function handleReset(){
  const users = getUsers();
  Object.values(users).forEach(u => {
    if(u.docsKey) localStorage.removeItem(u.docsKey);
  });
  localStorage.removeItem(LS_USERS);
  localStorage.removeItem(LS_REMEMBER);
  sessionStorage.removeItem(LS_SESSION);
  currentUser = null;

  await dbClearAllDocs();

  showSignup();
  showToast('Vault reset complete.');
}

function lockVault(){
  sessionStorage.removeItem(LS_SESSION);
  localStorage.removeItem(LS_REMEMBER);
  currentUser = null;
  document.getElementById('app').classList.remove('ready');
  document.getElementById('login-name').value='';
  document.getElementById('login-pass').value='';
  document.getElementById('login-error').textContent='';
  showLogin();
}

async function enterApp(){
  hideAllGates();
  await loadDocs();
  buildCategoryNav();
  populateCategorySelect();
  updateProfile();
  document.getElementById('app').classList.add('ready');
  updateCloudStatusUI();
  render();
  requestPersistentStorage();
  checkAndAutoSyncOnOpen();
}

function updateProfile(){
  if(!currentUser) return;
  const initials = currentUser.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('avatar-initials').textContent = initials;
  document.getElementById('profile-name').textContent = currentUser.name;
}

/* ================= DATA (INDEXEDDB POWERED) ================= */
async function loadDocs(){
  if(!currentUser) return;
  const userK = currentUser._key || userKey(currentUser.name);

  // 1. Try to load from IndexedDB
  const idbDocs = await dbGetAllDocs(userK);

  // 2. Check for legacy docs in localStorage to migrate seamlessly
  let legacyDocs = [];
  try{
    legacyDocs = JSON.parse(localStorage.getItem(currentUser.docsKey) || '[]');
  }catch(e){ legacyDocs = []; }

  if(idbDocs !== null){
    // Migrate any legacy docs that are not yet in IndexedDB
    if(legacyDocs.length > 0){
      for(const doc of legacyDocs){
        if(!idbDocs.some(d => d.id === doc.id)){
          doc.userKey = userK;
          await dbPutDoc(doc);
          idbDocs.push(doc);
        }
      }
      // Free up localStorage space once migrated!
      try{ localStorage.removeItem(currentUser.docsKey); }catch(e){}
    }
    state.docs = idbDocs.sort((a,b) => (b.addedAt||'').localeCompare(a.addedAt||''));
  } else {
    // Fallback if IndexedDB is blocked/unavailable in browser
    state.docs = legacyDocs;
  }
}

async function saveDocs(){
  if(!currentUser) return false;
  const userK = currentUser._key || userKey(currentUser.name);
  try{
    for(const doc of state.docs){
      doc.userKey = userK;
      await dbPutDoc(doc);
    }
    return true;
  }catch(e){
    // Fallback to localStorage
    try{
      localStorage.setItem(currentUser.docsKey, JSON.stringify(state.docs));
      return true;
    }catch(err){
      showToast("Storage full — try a smaller file", true);
      return false;
    }
  }
}

function computeStatus(doc){
  if(!doc.expiry) return 'active';
  const today = new Date(); today.setHours(0,0,0,0);
  const exp = new Date(doc.expiry+'T00:00:00');
  const diffDays = Math.round((exp-today)/86400000);
  if(diffDays < 0) return 'expired';
  if(diffDays <= 60) return 'expiring';
  return 'active';
}

/* ================= SIDEBAR NAV ================= */
function buildCategoryNav(){
  const list = document.getElementById('category-list');
  list.innerHTML = CATEGORIES.map(c=>\`
    <div class="nav-item" data-cat="\${c.id}" onclick="setCategory('\${c.id}')">
      <span class="nav-ic">\${c.icon}</span>
      <span class="nav-label">\${c.label}</span>
      <span class="nav-count" id="count-\${c.id}">0</span>
    </div>
  \`).join('');
}
function setCategory(id){
  state.category = id;
  document.querySelectorAll('.nav-item[data-cat]').forEach(el=>{
    el.classList.toggle('active', el.dataset.cat === id);
  });
  render();
}
function setStatusFilter(s){
  state.status = s;
  document.querySelectorAll('.chip[data-status]').forEach(el=>{
    el.classList.toggle('active', el.dataset.status === s);
  });
  render();
}
function populateCategorySelect(){
  const sel = document.getElementById('f-category');
  sel.innerHTML = CATEGORIES.map(c=>\`<option value="\${c.id}">\${c.label}</option>\`).join('');
}

/* ================= RENDER ================= */
function render(){
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const filtered = state.docs.filter(d=>{
    if(state.category !== '__all__' && d.category !== state.category) return false;
    const st = computeStatus(d);
    if(state.status !== '__all__' && st !== state.status) return false;
    if(q){
      const hay = (d.name+' '+getCatLabel(d.category)+' '+(d.notes||'')).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {};
  CATEGORIES.forEach(c=>counts[c.id]=0);
  let expiringAny = {}, expiredAny = {};
  state.docs.forEach(d=>{
    counts[d.category] = (counts[d.category]||0)+1;
    const st = computeStatus(d);
    if(st==='expiring') expiringAny[d.category]=true;
    if(st==='expired') expiredAny[d.category]=true;
  });
  CATEGORIES.forEach(c=>{
    const el = document.getElementById('count-'+c.id);
    if(el) el.textContent = counts[c.id] || '';
    const navItem = document.querySelector(\`.nav-item[data-cat="\${c.id}"]\`);
    if(navItem){
      let dotEl = navItem.querySelector('.status-dot');
      if(expiredAny[c.id] || expiringAny[c.id]){
        if(!dotEl){
          dotEl = document.createElement('span');
          dotEl.className='status-dot';
          navItem.insertBefore(dotEl, navItem.querySelector('.nav-label'));
        }
        dotEl.style.background = expiredAny[c.id] ? 'var(--bad)' : 'var(--warn)';
      } else if(dotEl){ dotEl.remove(); }
    }
  });
  document.getElementById('count-all').textContent = state.docs.length;

  const filledCats = CATEGORIES.filter(c=>counts[c.id]>0).length;
  document.getElementById('view-title').textContent = state.category==='__all__' ? 'All Documents' : getCatLabel(state.category);
  document.getElementById('view-sub').textContent = state.category==='__all__'
    ? \`\${state.docs.length} file\${state.docs.length!==1?'s':''} · \${filledCats}/\${CATEGORIES.length} categories filled\`
    : \`\${counts[state.category]||0} file\${(counts[state.category]||0)!==1?'s':''}\`;

  document.getElementById('profile-filecount').textContent = state.docs.length;
  document.getElementById('fill-bar').style.width = Math.round((filledCats/CATEGORIES.length)*100)+'%';

  const grid = document.getElementById('doc-grid');
  const empty = document.getElementById('empty-state');
  if(filtered.length===0){
    grid.style.display='none';
    empty.style.display='flex';
    if(state.docs.length===0){
      empty.innerHTML = \`\${ICONS.all}<h3>No documents yet</h3><p>Add your first document — a passport, license, policy, or anything worth keeping track of.</p>
        <button class="btn btn-primary" onclick="openAddModal()">Add Document</button>\`;
    } else {
      empty.innerHTML = \`\${ICONS.all}<h3>Nothing matches</h3><p>Try a different search or filter.</p>\`;
    }
  } else {
    grid.style.display='grid';
    empty.style.display='none';
    grid.innerHTML = filtered.map(d=>cardHtml(d)).join('');
  }
}

function fileIconFor(doc){
  if(doc.fileType && doc.fileType.startsWith('image/')) return ICONS.img;
  return ICONS.pdf;
}
function extLabel(doc){
  if(!doc.fileType) return getCatLabel(doc.category);
  if(doc.fileType.startsWith('image/')) return doc.fileType.split('/')[1].toUpperCase();
  if(doc.fileType==='application/pdf') return 'PDF';
  return (doc.fileName||'').split('.').pop().toUpperCase() || 'FILE';
}
function statusBadge(st){
  if(st==='active') return '<span class="badge ok">Active</span>';
  if(st==='expiring') return '<span class="badge warn">Expiring</span>';
  return '<span class="badge bad">Expired</span>';
}
function cardHtml(d){
  const st = computeStatus(d);
  return \`
  <div class="card" onclick="openDetail('\${d.id}')">
    <div class="card-top">
      <div class="file-ic">\${fileIconFor(d)}</div>
      \${statusBadge(st)}
    </div>
    <div class="card-name">\${escapeHtml(d.name || d.title || "Untitled Document")}</div>
    <div class="card-meta">
      <span class="tag">\${extLabel(d)}</span>
      <span class="tag cat">\${getCatLabel(d.category)}</span>
    </div>
  </div>\`;
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ================= ADD / EDIT MODAL ================= */
function openAddModal(){
  state.editingId = null;
  document.getElementById('doc-modal-title').textContent = 'Add Document';
  document.getElementById('f-name').value='';
  document.getElementById('f-category').value = state.category!=='__all__' ? state.category : 'other';
  document.getElementById('f-expiry').value='';
  document.getElementById('f-notes').value='';
  state.fileData = null;
  resetFilePreview();
  document.getElementById('doc-overlay').classList.add('show');
  setTimeout(()=>document.getElementById('f-name').focus(), 50);
}
function openEditModal(doc){
  state.editingId = doc.id;
  document.getElementById('doc-modal-title').textContent = 'Edit Document';
  document.getElementById('f-name').value = doc.name;
  document.getElementById('f-category').value = doc.category;
  document.getElementById('f-expiry').value = doc.expiry || '';
  document.getElementById('f-notes').value = doc.notes || '';
  if(doc.fileDataUrl){
    state.fileData = {dataUrl:doc.fileDataUrl, name:doc.fileName, type:doc.fileType};
    showFilePreview(state.fileData);
  } else {
    state.fileData = null;
    resetFilePreview();
  }
  document.getElementById('doc-overlay').classList.add('show');
}
function closeDocModal(){
  document.getElementById('doc-overlay').classList.remove('show');
}
function resetFilePreview(){
  document.getElementById('file-preview-box').style.display='none';
  document.getElementById('file-drop-zone').style.display='block';
  document.getElementById('f-file').value='';
}
function showFilePreview(fd){
  document.getElementById('file-drop-zone').style.display='none';
  const box = document.getElementById('file-preview-box');
  box.style.display='flex';
  const isImg = fd.type && fd.type.startsWith('image/');
  box.innerHTML = \`\${isImg ? \`<img src="\${fd.dataUrl}">\` : \`<div class="fp-ic">\${ICONS.pdf}</div>\`}
    <span class="fp-name">\${escapeHtml(fd.name)}</span>
    <span class="fp-remove" onclick="removeFile()">Remove</span>\`;
}
function removeFile(){
  state.fileData = null;
  resetFilePreview();
}
function handleFileSelect(e){
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 50*1024*1024){
    showToast('File too large — keep under ~50MB', true);
    e.target.value='';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev){
    state.fileData = {dataUrl: ev.target.result, name: file.name, type: file.type};
    showFilePreview(state.fileData);
    if(!document.getElementById('f-name').value){
      document.getElementById('f-name').value = file.name;
    }
  };
  reader.readAsDataURL(file);
}

async function saveDocument(){
  const name = document.getElementById('f-name').value.trim();
  if(!name){ showToast('Give the document a name', true); document.getElementById('f-name').focus(); return; }
  const category = document.getElementById('f-category').value;
  const expiry = document.getElementById('f-expiry').value;
  const notes = document.getElementById('f-notes').value.trim();
  const userK = currentUser._key || userKey(currentUser.name);

  let targetDoc = null;
  if(state.editingId){
    targetDoc = state.docs.find(d=>d.id===state.editingId);
    if(targetDoc){
      targetDoc.name = name; targetDoc.category = category; targetDoc.expiry = expiry; targetDoc.notes = notes;
      targetDoc.userKey = userK;
      if(state.fileData){
        targetDoc.fileDataUrl = state.fileData.dataUrl;
        targetDoc.fileName = state.fileData.name;
        targetDoc.fileType = state.fileData.type;
      } else {
        targetDoc.fileDataUrl = null; targetDoc.fileName=null; targetDoc.fileType=null;
      }
    }
  } else {
    targetDoc = {
      id: 'd'+Date.now()+Math.random().toString(36).slice(2,7),
      userKey: userK,
      name, category, expiry, notes,
      fileDataUrl: state.fileData ? state.fileData.dataUrl : null,
      fileName: state.fileData ? state.fileData.name : null,
      fileType: state.fileData ? state.fileData.type : null,
      addedAt: new Date().toISOString(),
    };
    state.docs.unshift(targetDoc);
  }

  // Save directly to IndexedDB
  const ok = targetDoc ? await dbPutDoc(targetDoc) : await saveDocs();
  if(ok !== false){
    closeDocModal();
    render();
    showToast(state.editingId ? 'Document updated' : 'Document added');
    const cloudCfg = getCloudConfig();
    if(isCloudConfigured(cloudCfg) && cloudCfg.autosync !== false){
      syncVaultToCloud(true);
    }
  } else {
    showToast('Failed to save document', true);
  }
}

/* ================= DETAIL MODAL ================= */
function openDetail(id){
  const doc = state.docs.find(d=>d.id===id);
  if(!doc) return;
  state.detailId = id;
  const st = computeStatus(doc);
  const docName = doc.name || doc.title || 'Untitled Document';
  document.getElementById('detail-title').textContent = docName;
  document.getElementById('detail-category').textContent = getCatLabel(doc.category);
  document.getElementById('detail-status').innerHTML = statusBadge(st);
  document.getElementById('detail-expiry').textContent = doc.expiry ? formatDate(doc.expiry) : 'No expiry';
  
  const rawAdded = doc.addedAt || doc.createdAt || new Date().toISOString();
  document.getElementById('detail-added').textContent = formatDate(rawAdded.slice(0,10));

  const notesWrap = document.getElementById('detail-notes-wrap');
  if(doc.notes){
    notesWrap.style.display='block';
    document.getElementById('detail-notes').textContent = doc.notes;
  } else {
    notesWrap.style.display='none';
  }

  const fileBox = document.getElementById('detail-file');
  const dlBtn = document.getElementById('detail-download');
  const viewBtn = document.getElementById('detail-view');
  const fileUrl = doc.fileDataUrl || doc.dataUrl;

  if(fileUrl){
    if(dlBtn) dlBtn.style.display='inline-flex';
    if(viewBtn) viewBtn.style.display='inline-flex';

    const isImg = (doc.fileType && doc.fileType.startsWith('image/')) || fileUrl.startsWith('data:image/');
    const isPdf = (doc.fileType === 'application/pdf') || fileUrl.startsWith('data:application/pdf') || (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf'));

    if(isImg){
      fileBox.innerHTML = \`
        <div style="position:relative; width:100%; display:flex; flex-direction:column; align-items:center; padding:8px 0;">
          <img src="\${fileUrl}" alt="\${escapeHtml(docName)}" style="max-width:100%; max-height:260px; object-fit:contain; border-radius:8px; cursor:zoom-in; box-shadow:0 4px 14px rgba(0,0,0,0.3);" onclick="openFullscreenPreview()" title="Click to view fullscreen">
          <div style="margin-top:8px; display:flex; gap:8px;">
            <button class="btn btn-ghost" style="font-size:12px; padding:4px 10px;" onclick="openFullscreenPreview()">🔍 View Full Image</button>
          </div>
        </div>\`;
    } else if(isPdf){
      fileBox.innerHTML = \`
        <div style="width:100%; display:flex; flex-direction:column; padding:4px 0;">
          <iframe src="\${fileUrl}#toolbar=1" style="width:100%; height:320px; border:1px solid var(--border); border-radius:8px; background:#fff;"></iframe>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span style="font-size:12px; color:var(--text-faint);">📄 PDF Document Preview</span>
            <button class="btn btn-ghost" style="font-size:12px; padding:4px 10px;" onclick="openFullscreenPreview()">⛶ Fullscreen PDF</button>
          </div>
        </div>\`;
    } else {
      fileBox.innerHTML = \`
        <div style="width:100%; display:flex; align-items:center; gap:12px; padding:12px; background:var(--surface-3); border-radius:8px;">
          <div class="fp-ic" style="width:48px;height:48px;border-radius:8px;">\${ICONS.pdf}</div>
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:500; font-size:13px; color:var(--text); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">\${escapeHtml(doc.fileName || docName)}</div>
            <div style="font-size:12px; color:var(--text-dim);">\${escapeHtml(doc.fileType || 'Document File')}</div>
          </div>
          <button class="btn btn-ghost" style="font-size:12px; padding:4px 10px;" onclick="openFullscreenPreview()">Open</button>
        </div>\`;
    }
  } else {
    if(dlBtn) dlBtn.style.display='none';
    if(viewBtn) viewBtn.style.display='none';
    fileBox.innerHTML = \`<div class="fp-ic" style="width:52px;height:52px;border-radius:10px;">\${getCatIcon(doc.category)}</div>\`;
  }
  document.getElementById('detail-overlay').classList.add('show');
}
function closeDetailModal(){
  document.getElementById('detail-overlay').classList.remove('show');
}
function formatDate(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
}
function editCurrentDoc(){
  const doc = state.docs.find(d=>d.id===state.detailId);
  closeDetailModal();
  openEditModal(doc);
}
async function deleteCurrentDoc(){
  const docId = state.detailId;
  state.docs = state.docs.filter(d=>d.id!==docId);
  await dbDeleteDoc(docId);
  closeDetailModal();
  render();
  showToast('Document deleted');
  const cloudCfg = getCloudConfig();
  if(isCloudConfigured(cloudCfg) && cloudCfg.autosync !== false){
    syncVaultToCloud(true);
  }
}
function downloadCurrentDoc(){
  const doc = state.docs.find(d=>d.id===state.detailId);
  if(!doc) return;
  const fileUrl = doc.fileDataUrl || doc.dataUrl;
  if(!fileUrl) return;
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = doc.fileName || doc.name || doc.title || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openFullscreenPreview(){
  const doc = state.docs.find(d=>d.id===state.detailId);
  if(!doc) return;
  const fileUrl = doc.fileDataUrl || doc.dataUrl;
  if(!fileUrl) return;

  const docName = escapeHtml(doc.name || doc.title || 'Document');
  document.getElementById('lightbox-title').textContent = doc.name || doc.title || 'Document Preview';
  
  const isImg = (doc.fileType && doc.fileType.startsWith('image/')) || fileUrl.startsWith('data:image/');
  const isPdf = (doc.fileType === 'application/pdf') || fileUrl.startsWith('data:application/pdf') || (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf'));
  const isText = (doc.fileType && doc.fileType.startsWith('text/')) || fileUrl.startsWith('data:text/');

  const bodyEl = document.getElementById('lightbox-body');
  const iconEl = document.getElementById('lightbox-icon');

  if(isImg){
    iconEl.innerHTML = ICONS.img || '🖼️';
    bodyEl.innerHTML = \`<img src="\${fileUrl}" alt="\${docName}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.6);">\`;
  } else if(isPdf){
    iconEl.innerHTML = ICONS.pdf || '📄';
    bodyEl.innerHTML = \`<iframe src="\${fileUrl}#view=FitH" style="width:100%; height:100%; border:none; border-radius:8px; background:#ffffff;"></iframe>\`;
  } else if(isText){
    iconEl.innerHTML = '📝';
    let textContent = '';
    try {
      const base64Part = fileUrl.split(',')[1];
      textContent = decodeURIComponent(escape(atob(base64Part)));
    } catch(e){
      try { textContent = atob(fileUrl.split(',')[1]); } catch(e2){ textContent = fileUrl; }
    }
    bodyEl.innerHTML = \`<pre style="width:100%; height:100%; margin:0; padding:24px; background:var(--surface-2); color:var(--text); border-radius:8px; overflow:auto; font-family:monospace; font-size:14px; line-height:1.6; white-space:pre-wrap;">\${escapeHtml(textContent)}</pre>\`;
  } else {
    iconEl.innerHTML = ICONS.pdf || '📁';
    bodyEl.innerHTML = \`<div style="text-align:center; color:var(--text);"><p style="font-size:16px; margin-bottom:12px;">No direct preview available for this file format.</p><button class="btn btn-primary" onclick="downloadCurrentDoc()">Download File</button></div>\`;
  }

  document.getElementById('preview-lightbox').classList.add('show');
}

function closeFullscreenPreview(){
  const lb = document.getElementById('preview-lightbox');
  if(lb){
    lb.classList.remove('show');
    const bodyEl = document.getElementById('lightbox-body');
    if(bodyEl) bodyEl.innerHTML = '';
  }
}

function viewCurrentDoc(){
  openFullscreenPreview();
}


// Explicit event listeners for Cloud & Backup buttons to ensure 100% responsiveness
function attachCloudButtonListeners(){
  const topBtn = document.getElementById('top-cloud-btn');
  if(topBtn){
    topBtn.removeEventListener('click', openCloudModal);
    topBtn.addEventListener('click', openCloudModal);
    topBtn.style.cursor = 'pointer';
  }
  const sideItem = document.getElementById('sidebar-cloud-item');
  if(sideItem){
    sideItem.removeEventListener('click', openCloudModal);
    sideItem.addEventListener('click', openCloudModal);
    sideItem.setAttribute('role', 'button');
    sideItem.setAttribute('tabindex', '0');
    sideItem.style.cursor = 'pointer';
    sideItem.addEventListener('keydown', ev=>{
      if(ev.key==='Enter' || ev.key===' '){
        ev.preventDefault();
        openCloudModal(ev);
      }
    });
  }
  const gateRecBtns = document.querySelectorAll('.recover-trigger-btn');
  gateRecBtns.forEach(btn=>{
    btn.removeEventListener('click', openGateRecoverModal);
    btn.addEventListener('click', openGateRecoverModal);
    btn.style.cursor = 'pointer';
  });
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', attachCloudButtonListeners);
} else {
  attachCloudButtonListeners();
}

/* ================= PWA & PLATFORM BRIDGE (DESKTOP & MOBILE) ================= */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isElectron = window.electronAPI && window.electronAPI.isElectron;
  if (!isStandalone && !isElectron) {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'inline-flex';
    const sidebarInstall = document.getElementById('sidebar-install-item');
    if (sidebarInstall) sidebarInstall.style.display = 'flex';
  }
});

async function triggerPwaInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('App installed successfully!');
    }
    deferredPrompt = null;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'none';
    const sidebarInstall = document.getElementById('sidebar-install-item');
    if (sidebarInstall) sidebarInstall.style.display = 'none';
  } else {
    alert('To install on your device:\\n\\n• Android Chrome: Tap the three dots (⋮) and choose "Install app" or "Add to Home screen".\\n• iPhone / iPad Safari: Tap the Share button and choose "Add to Home Screen".\\n• Windows Edge/Chrome: Click the Install icon in the address bar.');
  }
}

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) installBtn.style.display = 'none';
  const sidebarInstall = document.getElementById('sidebar-install-item');
  if (sidebarInstall) sidebarInstall.style.display = 'none';
  showToast('Keepsafe Vault installed!');
});

function checkPlatform() {
  if (window.electronAPI && window.electronAPI.isElectron) {
    document.body.classList.add('is-desktop-app');
    const brand = document.querySelector('.brand-name');
    if (brand && !brand.querySelector('.platform-pill')) {
      const pill = document.createElement('span');
      pill.className = 'platform-pill';
      pill.textContent = 'DESKTOP';
      brand.appendChild(pill);
    }
  }
}

init();
checkPlatform();

/* Click outer backdrop to close modals & Escape key support */
document.addEventListener('click', (e) => {
  if(e.target && e.target.classList && e.target.classList.contains('overlay')){
    if(e.target.id === 'doc-overlay') closeDocModal();
    else if(e.target.id === 'detail-overlay') closeDetailModal();
    else if(e.target.id === 'cloud-overlay') closeCloudModal();
    else if(e.target.id === 'gate-recover-overlay') closeGateRecoverModal();
    else if(e.target.id === 'preview-lightbox') closeFullscreenPreview();
    else e.target.classList.remove('show');
  }
});
window.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    closeDocModal();
    closeDetailModal();
    closeCloudModal();
    closeGateRecoverModal();
    closeFullscreenPreview();
  }
});


/* ================= CLOUD SYNC & ENCRYPTED BACKUP ENGINE ================= */
const LS_CLOUD_CONFIG = 'keepsafe_cloud_config_v2';
const LS_LAST_SYNC = 'keepsafe_last_sync_v2';

const DEFAULT_CF_WORKER = 'https://safira.gbrielsales11.workers.dev';

function getCloudConfig(){
  try{
    let cfg = JSON.parse(localStorage.getItem(LS_CLOUD_CONFIG) || '{}');
    const defaultUrl = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && window.location.origin.includes('workers.dev'))
      ? window.location.origin
      : (DEFAULT_CF_WORKER || 'https://safira.gbrielsales11.workers.dev');

    if(!cfg.cfUrl || !cfg.url){
      cfg.provider = 'cloudflare';
      cfg.cfUrl = defaultUrl;
      cfg.url = defaultUrl;
      cfg.autosync = true;
      cfg.syncOnOpen = true;
      try{ localStorage.setItem(LS_CLOUD_CONFIG, JSON.stringify(cfg)); }catch(e){}
    }
    return cfg;
  } catch(e){
    return { provider: 'cloudflare', cfUrl: 'https://safira.gbrielsales11.workers.dev', url: 'https://safira.gbrielsales11.workers.dev', autosync: true, syncOnOpen: true };
  }
}
function saveCloudConfig(cfg){
  localStorage.setItem(LS_CLOUD_CONFIG, JSON.stringify(cfg));
}

/* --- Web Crypto E2EE AES-GCM Helpers --- */
function bufferToBase64(buf){
  const bytes = new Uint8Array(buf);
  let binary = '';
  const len = bytes.byteLength;
  const chunk = 8192;
  for(let i = 0; i < len; i += chunk){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, len)));
  }
  return btoa(binary);
}

function base64ToBuffer(b64){
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++){
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveVaultKey(secret, salt){
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVaultPayload(payloadObj, secret){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(secret, salt);
  const jsonStr = JSON.stringify(payloadObj);
  const enc = new TextEncoder().encode(jsonStr);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  return {
    version: 2,
    magic: 'KEEPSAFE_ENCRYPTED_VAULT',
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(cipherBuf),
    updatedAt: new Date().toISOString()
  };
}

async function decryptVaultPayload(encryptedObj, secret){
  if(!encryptedObj || !encryptedObj.ciphertext || !encryptedObj.salt || !encryptedObj.iv){
    throw new Error('Invalid encrypted vault data format');
  }
  const salt = base64ToBuffer(encryptedObj.salt);
  const iv = base64ToBuffer(encryptedObj.iv);
  const cipherBytes = base64ToBuffer(encryptedObj.ciphertext);
  const key = await deriveVaultKey(secret, salt);
  const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  const jsonStr = new TextDecoder().decode(decryptedBuf);
  return JSON.parse(jsonStr);
}

/* --- Cloud Storage Provider Helper --- */
function isCloudConfigured(cfg = getCloudConfig()){
  return true; // Always active for Safira
}

/* --- Cloudflare Worker REST Client Methods --- */
async function pushToCloudflare(cfg, userKeyStr, encryptedData){
  const baseUrl = (cfg.cfUrl || cfg.url).replace(/\\/+$/, '');
  const endpoint = \`\${baseUrl}/api/vault\`;
  const headers = { 'Content-Type': 'application/json' };
  const token = cfg.cfToken || cfg.key;
  if(token) headers['X-Sync-Secret'] = token;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      user_id: userKeyStr,
      encrypted_data: encryptedData,
      updated_at: new Date().toISOString()
    })
  });
  if(!res.ok){
    const errText = await res.text();
    let msg = errText;
    try { const parsed = JSON.parse(errText); if(parsed.error) msg = parsed.error; }catch(e){}
    throw new Error(\`Cloudflare Worker Error (\${res.status}): \${msg}\`);
  }
  return true;
}

async function pullFromCloudflare(cfg, userKeyStr){
  const fallbackUrl = 'https://safira.gbrielsales11.workers.dev';
  const baseUrl = ((cfg && (cfg.cfUrl || cfg.url)) || fallbackUrl).replace(/\\/+$/, '');
  const endpoint = \`\${baseUrl}/api/vault?user_id=\${encodeURIComponent(userKeyStr)}\`;
  const headers = {};
  const token = (cfg && (cfg.cfToken || cfg.key)) || '';
  if(token) headers['X-Sync-Secret'] = token;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: headers
  });
  if(!res.ok){
    if(res.status === 404) return null;
    const errText = await res.text();
    let msg = errText;
    try { const parsed = JSON.parse(errText); if(parsed.error) msg = parsed.error; }catch(e){}
    throw new Error(\`Cloudflare Worker Error (\${res.status}): \${msg}\`);
  }
  const data = await res.json();
  if(!data || !data.found){
    return null;
  }
  return data.encrypted_data;
}

async function testCloudflareConnection(){
  const url = document.getElementById('cfg-cf-url').value.trim();
  const token = document.getElementById('cfg-cf-token').value.trim();
  const btn = document.getElementById('btn-test-cf');
  if(!url){
    showToast('Please enter the Cloudflare Worker URL first', true);
    return;
  }
  btn.classList.add('loading');
  try{
    const baseUrl = url.replace(/\\/+$/, '');
    const headers = {};
    if(token) headers['X-Sync-Secret'] = token;
    const res = await fetch(\`\${baseUrl}/health\`, { headers });
    if(!res.ok) throw new Error(\`HTTP \${res.status}\`);
    const data = await res.json();
    btn.classList.remove('loading');
    alert(\`✅ Cloudflare Connection Successful!\\n\\nStatus: \${data.status}\\nStorage: \${data.storage_type || 'Active'}\\nService: \${data.service}\`);
  }catch(e){
    btn.classList.remove('loading');
    alert(\`❌ Cloudflare connection failed: \${e.message}\\n\\nEnsure the Cloudflare Worker is deployed and URL is correct.\`);
  }
}

/* --- Storage Persistence Helper (Prevents Browser Auto-Eviction) --- */
async function requestPersistentStorage(){
  if(navigator.storage && navigator.storage.persist){
    try{
      const isPersisted = await navigator.storage.persist();
      updatePersistenceUI(isPersisted);
      return isPersisted;
    }catch(e){
      console.warn('Storage persist request:', e);
    }
  }
  return false;
}

async function enableStoragePersistence(){
  const granted = await requestPersistentStorage();
  if(granted){
    showToast('Storage persistence granted! Protected against cache clearing.');
  } else {
    showToast('Storage persistence is already managed by your browser.');
  }
}

async function updatePersistenceUI(isPersisted){
  const textEl = document.getElementById('storage-persist-text');
  const btn = document.getElementById('btn-request-persist');
  if(navigator.storage && navigator.storage.persisted){
    if(isPersisted === undefined) isPersisted = await navigator.storage.persisted();
  }
  if(textEl && btn){
    if(isPersisted){
      textEl.textContent = '✅ Secured: Data is protected against automatic browser eviction.';
      btn.style.display = 'none';
    } else {
      textEl.textContent = 'Prevents the browser from automatically evicting your local cache';
      btn.style.display = 'inline-flex';
    }
  }
}

/* --- Supabase REST Client Methods --- */
async function pushToSupabase(cfg, userKeyStr, encryptedData){
  const baseUrl = cfg.url.replace(/\\/+$/, '');
  const endpoint = \`\${baseUrl}/rest/v1/keepsafe_vault\`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': cfg.key,
      'Authorization': \`Bearer \${cfg.key}\`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify([{
      user_id: userKeyStr,
      encrypted_data: JSON.stringify(encryptedData),
      updated_at: new Date().toISOString()
    }])
  });
  if(!res.ok){
    const errText = await res.text();
    if(res.status === 404 || errText.includes('does not exist')){
      throw new Error('SQL table not yet created in Supabase. Follow SQL guide below.');
    }
    throw new Error(\`Supabase Error (\${res.status}): \${errText}\`);
  }
  return true;
}

async function pullFromSupabase(cfg, userKeyStr){
  const baseUrl = cfg.url.replace(/\\/+$/, '');
  const endpoint = \`\${baseUrl}/rest/v1/keepsafe_vault?user_id=eq.\${encodeURIComponent(userKeyStr)}&select=*\`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'apikey': cfg.key,
      'Authorization': \`Bearer \${cfg.key}\`
    }
  });
  if(!res.ok){
    const errText = await res.text();
    throw new Error(\`Supabase Error (\${res.status}): \${errText}\`);
  }
  const rows = await res.json();
  if(!rows || rows.length === 0){
    return null;
  }
  return JSON.parse(rows[0].encrypted_data);
}

/* --- UI Modal Handlers --- */
let currentCloudProvider = 'cloudflare';
let currentRecProvider = 'cloudflare';

function switchCloudProvider(prov){
  currentCloudProvider = prov;
  document.getElementById('prov-btn-cf').classList.toggle('active', prov === 'cloudflare');
  document.getElementById('prov-btn-sb').classList.toggle('active', prov === 'supabase');
  document.getElementById('provider-section-cf').style.display = prov === 'cloudflare' ? 'block' : 'none';
  document.getElementById('provider-section-sb').style.display = prov === 'supabase' ? 'block' : 'none';
  const cfGuide = document.getElementById('setup-guide-cf');
  const sbGuide = document.getElementById('setup-guide-sb');
  if(cfGuide) cfGuide.style.display = prov === 'cloudflare' ? 'block' : 'none';
  if(sbGuide) sbGuide.style.display = prov === 'supabase' ? 'block' : 'none';
  if(prov === 'cloudflare' && cfGuide) cfGuide.open = true;
}

function switchRecProvider(prov){
  currentRecProvider = prov;
  document.getElementById('rec-prov-cf').classList.toggle('active', prov === 'cloudflare');
  document.getElementById('rec-prov-sb').classList.toggle('active', prov === 'supabase');
  document.getElementById('rec-fields-cf').style.display = prov === 'cloudflare' ? 'block' : 'none';
  document.getElementById('rec-fields-sb').style.display = prov === 'supabase' ? 'block' : 'none';
}

function copyWorkerCode(){
  const workerScript = \`/**
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

    // Handle Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Optional Token Authentication
    const syncSecret = env.SYNC_SECRET;
    if (syncSecret) {
      const authHeader = request.headers.get('X-Sync-Secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
      if (authHeader !== syncSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Sync Secret Token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 1. Health check endpoint
    if (url.pathname === '/health') {
      const hasKV = !!env.VAULT_KV;
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'Keepsafe Vault Cloudflare Sync',
        kv_bound: hasKV,
        storage_type: hasKV ? 'Cloudflare KV (Permanent Cloud Storage)' : 'Memory Cache (Link VAULT_KV in Settings for permanent storage)',
        time: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Vault Sync API Endpoint
    if (url.pathname === '/api/vault') {
      // GET: Pull Encrypted Vault Payload
      if (request.method === 'GET') {
        const userId = url.searchParams.get('user_id');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing user_id parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let encryptedData = null;
        let updatedAt = null;

        if (env.VAULT_KV) {
          const raw = await env.VAULT_KV.get(\\\`vault:\\\${userId}\\\`);
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
          return new Response(JSON.stringify({ found: false, message: 'No vault data found for this user' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          found: true,
          user_id: userId,
          encrypted_data: encryptedData,
          updated_at: updatedAt
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST: Push & Save Encrypted Vault Payload
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const { user_id, encrypted_data, updated_at } = body;

          if (!user_id || !encrypted_data) {
            return new Response(JSON.stringify({ error: 'Missing user_id or encrypted_data in payload' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const record = {
            user_id,
            encrypted_data,
            updated_at: updated_at || new Date().toISOString()
          };

          if (env.VAULT_KV) {
            await env.VAULT_KV.put(\\\`vault:\\\${user_id}\\\`, JSON.stringify(record));
          } else {
            memoryCache.set(user_id, record);
          }

          return new Response(JSON.stringify({
            success: true,
            user_id,
            kv_persisted: !!env.VAULT_KV,
            updated_at: record.updated_at
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload: ' + err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // 3. Fallback: If deployed via Cloudflare Pages or Workers Assets (e.g. GitHub repo), serve static index.html
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    // Default message if tested directly in browser
    return new Response('⚡ Keepsafe Vault Cloudflare Sync Engine is active! Sync endpoint: /api/vault', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
};
\`;
  navigator.clipboard.writeText(workerScript).then(()=>{
    showToast('Cloudflare Worker code copied to clipboard!');
  }).catch(()=>{
    showToast('Failed to copy code', true);
  });
}

function openCloudModal(e){
  if(e && e.preventDefault) e.preventDefault();
  if(e && e.stopPropagation) e.stopPropagation();

  // Instantly show overlay so button is 100% responsive
  const overlay = document.getElementById('cloud-overlay');
  if(overlay){
    overlay.style.display = 'flex';
    overlay.classList.add('show');
  }

  try{
    const cfg = getCloudConfig() || {};
    const prov = cfg.provider || (cfg.cfUrl ? 'cloudflare' : (cfg.url && cfg.url.includes('supabase') ? 'supabase' : 'cloudflare'));
    if(typeof switchCloudProvider === 'function'){
      switchCloudProvider(prov);
    }

    const cfUrlEl = document.getElementById('cfg-cf-url');
    if(cfUrlEl) cfUrlEl.value = cfg.cfUrl || (prov === 'cloudflare' ? cfg.url : '') || '';

    const cfTokEl = document.getElementById('cfg-cf-token');
    if(cfTokEl) cfTokEl.value = cfg.cfToken || '';

    const clUrlEl = document.getElementById('cfg-cloud-url');
    if(clUrlEl) clUrlEl.value = cfg.url || '';

    const clKeyEl = document.getElementById('cfg-cloud-key');
    if(clKeyEl) clKeyEl.value = cfg.key || '';

    const autoSyncEl = document.getElementById('cfg-cloud-autosync');
    if(autoSyncEl) autoSyncEl.checked = cfg.autosync !== false;

    const reopenSyncEl = document.getElementById('cfg-cloud-reopen-sync');
    if(reopenSyncEl) reopenSyncEl.checked = cfg.syncOnOpen !== false;

    if(typeof updateCloudStatusUI === 'function') updateCloudStatusUI();
    if(typeof updatePersistenceUI === 'function') updatePersistenceUI();
  }catch(err){
    console.warn('Notice in openCloudModal:', err);
  }
}

function closeCloudModal(e){
  if(e && e.preventDefault) e.preventDefault();
  const overlay = document.getElementById('cloud-overlay');
  if(overlay){
    overlay.style.display = 'none';
    overlay.classList.remove('show');
  }
}

function openGateRecoverModal(e){
  if(e && e.preventDefault) e.preventDefault();
  if(e && e.stopPropagation) e.stopPropagation();
  const errF = document.getElementById('rec-file-error');
  if(errF) errF.textContent = '';
  const errC = document.getElementById('rec-cloud-error');
  if(errC) errC.textContent = '';
  const overlay = document.getElementById('gate-recover-overlay');
  if(overlay){
    overlay.style.display = 'flex';
    overlay.classList.add('show');
  }
}

function closeGateRecoverModal(e){
  if(e && e.preventDefault) e.preventDefault();
  const overlay = document.getElementById('gate-recover-overlay');
  if(overlay){
    overlay.style.display = 'none';
    overlay.classList.remove('show');
  }
}

function switchCloudTab(tab){
  const isSync = tab === 'sync';
  document.getElementById('tab-btn-sync').classList.toggle('active', isSync);
  document.getElementById('tab-btn-file').classList.toggle('active', !isSync);
  document.getElementById('cloud-tab-sync').style.display = isSync ? 'block' : 'none';
  document.getElementById('cloud-tab-file').style.display = !isSync ? 'block' : 'none';
}

function switchRecTab(tab){
  const isFile = tab === 'file';
  document.getElementById('tab-btn-rec-file').classList.toggle('active', isFile);
  document.getElementById('tab-btn-rec-cloud').classList.toggle('active', !isFile);
  document.getElementById('rec-tab-file').style.display = isFile ? 'block' : 'none';
  document.getElementById('rec-tab-cloud').style.display = !isFile ? 'block' : 'none';
}

function copySqlCode(){
  const code = document.getElementById('supabase-sql-code').textContent;
  navigator.clipboard.writeText(code).then(()=>{
    showToast('SQL script copied to clipboard!');
  }).catch(()=>{
    showToast('Failed to copy', true);
  });
}

function updateCloudStatusUI(){
  const cfg = getCloudConfig();
  const configured = isCloudConfigured(cfg);
  const prov = cfg.provider || (cfg.cfUrl ? 'cloudflare' : (cfg.url && cfg.url.includes('supabase') ? 'supabase' : 'cloudflare'));
  const badge = document.getElementById('cloud-status-badge');
  const dot = document.getElementById('cloud-status-dot');
  const desc = document.getElementById('cloud-status-desc');
  const lastSyncTimeEl = document.getElementById('cloud-last-sync-time');
  const lastSync = localStorage.getItem(LS_LAST_SYNC);

  if(lastSyncTimeEl){
    lastSyncTimeEl.textContent = lastSync ? \`Last sync: \${new Date(lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}\` : 'Last sync: Never';
  }

  if(!configured){
    if(badge){ badge.className = 'status-indicator-badge'; badge.textContent = '○ Disconnected'; }
    if(dot){ dot.className = 'cloud-status-dot disconnected'; }
    if(desc){ desc.textContent = 'Connect to Cloudflare Worker or Supabase to automatically keep your documents backed up in the cloud.'; }
  } else {
    const provName = prov === 'cloudflare' ? 'Cloudflare Workers' : 'Supabase';
    const host = prov === 'cloudflare' ? (cfg.cfUrl || cfg.url || '').replace(/^https?:\\/\\//, '').split('/')[0] : (cfg.url || '').replace(/^https?:\\/\\//, '').split('.')[0] + '.supabase.co';
    if(badge){ badge.className = 'status-indicator-badge ok'; badge.textContent = \`● Connected to \${provName}\`; }
    if(dot){ dot.className = 'cloud-status-dot connected'; }
    if(desc){ desc.textContent = \`Linked to \${host} (Auto-sync: \${cfg.autosync !== false ? 'ON' : 'OFF'}, On Open: \${cfg.syncOnOpen !== false ? 'ON' : 'OFF'})\`; }
  }
}

/* --- Sync & Backup Core Operations --- */
async function syncVaultToCloud(isSilent = false){
  if(!currentUser) return false;
  const cfg = getCloudConfig();
  if(!isCloudConfigured(cfg)) return false;

  const dot = document.getElementById('cloud-status-dot');
  if(dot) dot.className = 'cloud-status-dot syncing';

  const userK = currentUser._key || userKey(currentUser.name);
  const docs = state.docs;
  const payload = {
    app: 'Keepsafe Vault',
    version: 2,
    user: currentUser,
    docs: docs,
    exportedAt: new Date().toISOString()
  };

  try{
    const encrypted = await encryptVaultPayload(payload, currentUser.passHash);
    const prov = cfg.provider || (cfg.cfUrl ? 'cloudflare' : (cfg.url && cfg.url.includes('supabase') ? 'supabase' : 'cloudflare'));
    if(prov === 'cloudflare'){
      await pushToCloudflare(cfg, userK, encrypted);
    } else {
      await pushToSupabase(cfg, userK, encrypted);
    }
    localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
    updateCloudStatusUI();
    if(!isSilent) showToast('Cloud sync complete! Securely saved to Cloudflare.');
    return true;
  }catch(err){
    console.error('Cloud Sync failed:', err);
    if(dot) dot.className = 'cloud-status-dot disconnected';
    if(!isSilent) alert('Cloud Sync error: ' + err.message);
    return false;
  }
}

async function saveCloudSettingsAndSync(){
  const prov = currentCloudProvider;
  let newCfg = { provider: prov };

  if(prov === 'cloudflare'){
    const cfUrl = document.getElementById('cfg-cf-url').value.trim();
    const cfToken = document.getElementById('cfg-cf-token').value.trim();
    if(!cfUrl){
      showToast('Please enter the Cloudflare Worker URL', true);
      return;
    }
    newCfg.cfUrl = cfUrl;
    newCfg.url = cfUrl;
    newCfg.cfToken = cfToken;
  } else {
    const url = document.getElementById('cfg-cloud-url').value.trim();
    const key = document.getElementById('cfg-cloud-key').value.trim();
    if(!url || !key){
      showToast('Please enter Supabase URL and Public Anon Key', true);
      return;
    }
    newCfg.url = url;
    newCfg.key = key;
  }

  newCfg.autosync = document.getElementById('cfg-cloud-autosync').checked;
  newCfg.syncOnOpen = document.getElementById('cfg-cloud-reopen-sync').checked;

  const btn = document.getElementById('btn-save-cloud-cfg');
  btn.classList.add('loading');
  saveCloudConfig(newCfg);

  const ok = await syncVaultToCloud(false);
  btn.classList.remove('loading');
  if(ok){
    updateCloudStatusUI();
  }
}

function disconnectCloud(){
  if(confirm('Disconnect Cloud connection? Your local data will remain intact.')){
    localStorage.removeItem(LS_CLOUD_CONFIG);
    localStorage.removeItem(LS_LAST_SYNC);
    updateCloudStatusUI();
    showToast('Cloud connection removed');
  }
}

async function pullFromCloudManual(){
  if(!currentUser) return;
  const cfg = getCloudConfig();
  if(!isCloudConfigured(cfg)){
    showToast('Please save Cloudflare Worker or Supabase URL first', true);
    return;
  }
  const btn = document.getElementById('btn-pull-cloud');
  btn.classList.add('loading');

  const userK = currentUser._key || userKey(currentUser.name);
  try{
    const prov = cfg.provider || (cfg.cfUrl ? 'cloudflare' : (cfg.url && cfg.url.includes('supabase') ? 'supabase' : 'cloudflare'));
    let encrypted = null;
    if(prov === 'cloudflare'){
      encrypted = await pullFromCloudflare(cfg, userK);
    } else {
      encrypted = await pullFromSupabase(cfg, userK);
    }

    if(!encrypted){
      alert('No synced vault found in the cloud for this account.');
      btn.classList.remove('loading');
      return;
    }
    const decrypted = await decryptVaultPayload(encrypted, currentUser.passHash);
      if(Array.isArray(decrypted.docs)){
        await reconcileWithCloudDocs(userK, decrypted.docs);
        showToast('Restored ' + decrypted.docs.length + ' documents from Cloud!');
      }
    }catch(e){
    alert('Failed to pull from cloud: ' + e.message);
  } finally {
    btn.classList.remove('loading');
  }
}

/* --- One-Click File Export & Restore --- */
async function exportVaultBackupFile(){
  if(!currentUser) return;
  const userK = currentUser._key || userKey(currentUser.name);
  const docs = state.docs;
  const payload = {
    app: 'Keepsafe Vault',
    version: 2,
    user: currentUser,
    docs: docs,
    exportedAt: new Date().toISOString()
  };

  try{
    const encrypted = await encryptVaultPayload(payload, currentUser.passHash);
    const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = \`keepsafe-vault-\${userK}-\${dateStr}.vault\`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Backup file downloaded! You can save it to Google Drive, OneDrive, or USB.');
  }catch(err){
    showToast('Export failed: ' + err.message, true);
  }
}

async function executeModalFileRestore(){
  const fileInput = document.getElementById('modal-restore-file');
  const passInput = document.getElementById('modal-restore-pass');
  const btn = document.getElementById('modal-restore-btn');

  if(!fileInput.files || fileInput.files.length === 0){
    showToast('Please select a .vault backup file', true);
    return;
  }
  if(!passInput.value){
    showToast('Please enter your vault password', true);
    return;
  }

  btn.classList.add('loading');
  try{
    const file = fileInput.files[0];
    const text = await file.text();
    const encrypted = JSON.parse(text);
    const hash = await sha256(passInput.value);
    const decrypted = await decryptVaultPayload(encrypted, hash);

    const userK = currentUser._key || userKey(currentUser.name);
    if(Array.isArray(decrypted.docs)){
      for(const doc of decrypted.docs){
        doc.userKey = userK;
        await dbPutDoc(doc);
      }
      await loadDocs();
      render();
      closeCloudModal();
      showToast(\`Success! Restored \${decrypted.docs.length} documents from backup file.\`);
    }
  }catch(err){
    alert('Incorrect password or corrupted backup file: ' + err.message);
  } finally {
    btn.classList.remove('loading');
  }
}

/* --- Recovery from Gate (When browser data was wiped) --- */
async function executeFileRecovery(){
  const fileInput = document.getElementById('rec-file-input');
  const passInput = document.getElementById('rec-file-pass');
  const errEl = document.getElementById('rec-file-error');
  const btn = document.getElementById('rec-file-btn');

  if(!fileInput.files || fileInput.files.length === 0){
    errEl.textContent = 'Please select a .vault backup file first.';
    return;
  }
  if(!passInput.value){
    errEl.textContent = 'Please enter your vault password.';
    return;
  }

  errEl.textContent = '';
  btn.classList.add('loading');

  try{
    const file = fileInput.files[0];
    const text = await file.text();
    const encrypted = JSON.parse(text);
    const hash = await sha256(passInput.value);
    const decrypted = await decryptVaultPayload(encrypted, hash);

    if(!decrypted.user){
      throw new Error('No account data in backup file.');
    }

    const restoredUser = decrypted.user;
    const userK = restoredUser._key || userKey(restoredUser.name);

    // Save restored user
    const users = getUsers();
    users[userK] = restoredUser;
    saveUsers(users);

    // Save restored docs to IndexedDB
    if(Array.isArray(decrypted.docs)){
      for(const doc of decrypted.docs){
        doc.userKey = userK;
        await dbPutDoc(doc);
      }
    }

    currentUser = restoredUser;
    currentUser._key = userK;
    sessionStorage.setItem(LS_SESSION, userK);
    localStorage.setItem(LS_REMEMBER, userK);

    closeGateRecoverModal();
    await enterApp();
    showToast(\`Welcome back! Restored \${decrypted.docs ? decrypted.docs.length : 0} files.\`);
  }catch(err){
    errEl.textContent = 'Incorrect password or invalid backup file.';
  } finally {
    btn.classList.remove('loading');
  }
}

async function executeCloudRecovery(){
  const prov = currentRecProvider;
  const userName = document.getElementById('rec-cloud-user').value.trim();
  const pass = document.getElementById('rec-cloud-pass').value;
  const errEl = document.getElementById('rec-cloud-error');
  const btn = document.getElementById('rec-cloud-btn');

  let cfg = { provider: prov, autosync: true, syncOnOpen: true };

  if(prov === 'cloudflare'){
    const cfUrl = document.getElementById('rec-cf-url').value.trim();
    const cfToken = document.getElementById('rec-cf-token').value.trim();
    if(!cfUrl || !userName || !pass){
      errEl.textContent = 'Please complete Worker URL, Username, and Password.';
      return;
    }
    cfg.cfUrl = cfUrl;
    cfg.url = cfUrl;
    cfg.cfToken = cfToken;
  } else {
    const url = document.getElementById('rec-cloud-url').value.trim();
    const key = document.getElementById('rec-cloud-key').value.trim();
    if(!url || !key || !userName || !pass){
      errEl.textContent = 'Please complete Supabase URL, Key, Username, and Password.';
      return;
    }
    cfg.url = url;
    cfg.key = key;
  }

  errEl.textContent = '';
  btn.classList.add('loading');

  try{
    const userK = userKey(userName);
    let encrypted = null;
    if(prov === 'cloudflare'){
      encrypted = await pullFromCloudflare(cfg, userK);
    } else {
      encrypted = await pullFromSupabase(cfg, userK);
    }

    if(!encrypted){
      throw new Error(\`No saved vault found in \${prov === 'cloudflare' ? 'Cloudflare' : 'Supabase'} for this user.\`);
    }

    const hash = await sha256(pass);
    const decrypted = await decryptVaultPayload(encrypted, hash);

    const restoredUser = decrypted.user || {
      name: userName,
      passHash: hash,
      docsKey: 'keepsafe_docs_' + userK,
      createdAt: new Date().toISOString()
    };

    const users = getUsers();
    users[userK] = restoredUser;
    saveUsers(users);

    saveCloudConfig(cfg);

    if(Array.isArray(decrypted.docs)){
      for(const doc of decrypted.docs){
        doc.userKey = userK;
        await dbPutDoc(doc);
      }
    }

    currentUser = restoredUser;
    currentUser._key = userK;
    sessionStorage.setItem(LS_SESSION, userK);
    localStorage.setItem(LS_REMEMBER, userK);

    closeGateRecoverModal();
    await enterApp();
    showToast(\`Connected to Cloud! Restored \${decrypted.docs ? decrypted.docs.length : 0} files.\`);
  }catch(err){
    errEl.textContent = err.message || 'Invalid credentials or connection error.';
  } finally {
    btn.classList.remove('loading');
  }
}

/* --- Auto-Sync on App Reopen / Backgrounding Protection --- */
async function checkAndAutoSyncOnOpen(){
  if(!currentUser) return;
  const cfg = getCloudConfig();
  if(!isCloudConfigured(cfg) || cfg.syncOnOpen === false) return;

  const userK = currentUser._key || userKey(currentUser.name);
  const dot = document.getElementById('cloud-status-dot');
  if(dot) dot.className = 'cloud-status-dot syncing';

  try{
    const prov = cfg.provider || (cfg.cfUrl ? 'cloudflare' : (cfg.url && cfg.url.includes('supabase') ? 'supabase' : 'cloudflare'));
    let encrypted = null;
    if(prov === 'cloudflare'){
      encrypted = await pullFromCloudflare(cfg, userK);
    } else {
      encrypted = await pullFromSupabase(cfg, userK);
    }

    if(encrypted){
      const decrypted = await decryptVaultPayload(encrypted, currentUser.passHash);
      const cloudTime = new Date(encrypted.updated_at || encrypted.updatedAt || 0).getTime();
      const localTime = new Date(localStorage.getItem(LS_LAST_SYNC) || 0).getTime();
      const localDocs = await dbGetAllDocs(userK) || [];
      const cloudDocs = Array.isArray(decrypted.docs) ? decrypted.docs : [];
      const cloudDocIds = new Set(cloudDocs.map(function(d){ return d.id; }));
      const hasMismatch = localDocs.length !== cloudDocs.length || localDocs.some(function(d){ return !cloudDocIds.has(d.id); });

      if(cloudTime > localTime || localDocs.length === 0 || hasMismatch){
        await reconcileWithCloudDocs(userK, cloudDocs);
        localStorage.setItem(LS_LAST_SYNC, new Date(cloudTime || Date.now()).toISOString());
        showToast('Synced from Cloud (' + cloudDocs.length + ' ' + (cloudDocs.length === 1 ? 'file' : 'files') + ')');
      }
    } else {
      const localDocs = await dbGetAllDocs(userK) || [];
      if(localDocs.length > 0){
        await syncVaultToCloud(true);
      }
    }
  }catch(e){
    console.warn('Auto-sync check notice:', e);
  } finally {
    updateCloudStatusUI();
  }
}

// Ensure data is synced when tab becomes hidden or app is closed
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && currentUser) {
    const cfg = getCloudConfig();
    if (isCloudConfigured(cfg) && cfg.autosync !== false) {
      syncVaultToCloud(true);
    }
  }
});

</script>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration skipped:', err));
        });
      }
    </script>
</body>
</html>
`;

    return new Response(appHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
};
