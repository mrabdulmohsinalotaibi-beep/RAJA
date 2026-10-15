import {contactMethods,passwordConfigured} from './auth-config.js';
// Google OpenID Connect utilities for RAJA Cloudflare Pages Functions.
// Only Google email/profile/openid scopes; never request YouTube account access.
const encoder = new TextEncoder();
const GOOGLE_KEYS = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_CALLBACK = 'https://raja.athat.app/api/auth/callback';
export const SESSION_COOKIE = 'raja_session';
export const STATE_COOKIE = 'raja_oauth_state';

export const googleConfigured = env => Boolean(
  env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET && env?.RAJA_SESSION_SECRET &&
  String(env.RAJA_SESSION_SECRET).length >= 32
);
export const configured = env => passwordConfigured(env)||googleConfigured(env)||Object.values(contactMethods(env)).some(Boolean);
export const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
  }
});
export function base64url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function unbase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error('bad-encoding');
  const s = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
export function randomToken(size = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(size)));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function seal(payload, secret) {
  const token = base64url(encoder.encode(JSON.stringify(payload)));
  const raw = 'v1.' + token;
  const digest = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(raw));
  return raw + '.' + base64url(new Uint8Array(digest));
}
export async function unseal(value, secret) {
  if (!value || value.length > 4000) return null;
  try {
    const [version, payload, signature, extra] = value.split('.');
    if (extra !== undefined || version !== 'v1') return null;
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), unbase64url(signature), encoder.encode('v1.' + payload));
    if (!valid) return null;
    const decoded = JSON.parse(new TextDecoder().decode(unbase64url(payload)));
    return decoded && typeof decoded === 'object' ? decoded : null;
  } catch { return null; }
}
export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const field = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return field ? field.slice(name.length + 1) : null;
}
export const cookie = (name, token, age) =>
  name + '=' + token + '; Path=/; Max-Age=' + age + '; HttpOnly; Secure; SameSite=Lax';
export const expireCookie = name => cookie(name, '', 0);
export async function currentUser(request, env) {
  if (!configured(env)) return null;
  const value = await unseal(getCookie(request, SESSION_COOKIE), env.RAJA_SESSION_SECRET);
  const now = Math.floor(Date.now() / 1000);
  if (!value || !['raja-google','raja-contact','raja-password'].includes(value.iss) || !value.sub ||
      (value.iss==='raja-google'&&!value.email) || (value.iss==='raja-contact'&&!value.email&&!value.phone) ||
      !Number.isInteger(value.iat) || !Number.isInteger(value.exp) ||
      value.iat > now + 30 || value.exp < now || value.exp > now + 8 * 86400) return null;
  if(value.iss==='raja-password'){
    if(!env.RAJA_DB||!value.sid||!value.email)return null;
    try{const session=await env.RAJA_DB.prepare('SELECT s.user_id FROM raja_password_sessions s JOIN raja_accounts a ON a.id=s.user_id LEFT JOIN raja_user_controls c ON c.user_id=a.id WHERE s.session_id=? AND s.user_id=? AND s.expires_at>? AND s.credential_version=a.credential_version AND COALESCE(c.suspended,0)=0').bind(value.sid,value.sub,now).first();if(!session)return null}catch{return null}
  }
  return { id: String(value.sub), email: String(value.email||''), phone: String(value.phone||''), name: String(value.name || ''), emailVerified:value.iss!=='raja-password' };
}
export async function requireUser(request, env) {
  if (!configured(env)) return null; // Preserve the existing public site until OAuth credentials are set.
  const user = await currentUser(request, env);
  return user ? null : json({ ok: false, error: 'google_signin_required', message: 'سجل الدخول إلى حسابك أولًا.' }, 401);
}
export function userOriginAllowed(request) {
  const origin = request.headers.get('Origin');
  return origin === 'https://raja.athat.app';
}
export async function verifyGoogleIdToken(token, expectedAudience, nonce) {
  if (typeof token !== 'string' || token.length > 10000) throw Error('missing-google-id-token');
  const pieces = token.split('.');
  if (pieces.length !== 3) throw Error('invalid-jwt');
  const header = JSON.parse(new TextDecoder().decode(unbase64url(pieces[0])));
  const claims = JSON.parse(new TextDecoder().decode(unbase64url(pieces[1])));
  if (header.alg !== 'RS256' || !header.kid) throw Error('invalid-jwt-alg');
  const certs = await fetch(GOOGLE_KEYS, { headers: { Accept: 'application/json' }, cf: { cacheTtl: 1800 } });
  if (!certs.ok) throw Error('google-jwk-unavailable');
  const jwk = (await certs.json()).keys?.find(x => x.kid === header.kid && x.kty === 'RSA' && (!x.use || x.use === 'sig'));
  if (!jwk) throw Error('unknown-google-key');
  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signatureValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, unbase64url(pieces[2]), encoder.encode(pieces[0] + '.' + pieces[1]));
  const now = Math.floor(Date.now() / 1000);
  if (!signatureValid || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
      claims.aud !== expectedAudience || claims.nonce !== nonce ||
      !claims.sub || claims.email_verified !== true || !claims.email ||
      !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.iat) || claims.iat > now + 60) throw Error('invalid-google-claims');
  return { sub: String(claims.sub), email: String(claims.email), name: String(claims.name || '').slice(0,120) };
}
