import crypto from 'node:crypto';
import http2 from 'node:http2';

// APNs authentication credentials are read only at request time from Vercel's
// protected server environment. Never bundle the .p8 file in the application.
const jwtCache = new Map();
export function apnsConfigured(env = process.env) {
  return Boolean(env.APNS_TEAM_ID && env.APNS_KEY_ID &&
    env.APNS_PRIVATE_KEY && env.APNS_BUNDLE_ID);
}
export function createApnsProviderToken(env = process.env, now = Date.now()) {
  if (!apnsConfigured(env)) throw new Error('APNs is not configured');
  const cacheKey = env.APNS_TEAM_ID + ':' + env.APNS_KEY_ID;
  const prev = jwtCache.get(cacheKey);
  if (prev && now - prev.createdAt < 45 * 60 * 1000) return prev.value;
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: env.APNS_KEY_ID }))
    .toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: env.APNS_TEAM_ID, iat: Math.floor(now / 1000)
  })).toString('base64url');
  const signingInput = header + '.' + claims;
  const pem = env.APNS_PRIVATE_KEY.replace(/\\n/g, '\n').trim() + '\n';
  const privateKey = crypto.createPrivateKey(pem);
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: privateKey, dsaEncoding: 'ieee-p1363'
  }).toString('base64url');
  const result = signingInput + '.' + signature;
  jwtCache.set(cacheKey, { value: result, createdAt: now });
  return result;
}
function apnsPayload(event, destination) {
  return JSON.stringify({
    aps: {
      alert: {
        title: String(event.title || 'GLSK League Office').slice(0, 140),
        body: String(event.body || 'New league activity').slice(0, 600)
      },
      sound: 'default'
    },
    eventId: String(event.id || ''),
    url: String(destination || '/league?tab=notifications')
  });
}
function sendViaSession(session, token, event, config, authToken, destination) {
  return new Promise(resolve => {
    if (!/^[a-fA-F0-9]{64,400}$/.test(String(token || ''))) {
      resolve({ok:false,gone:true,status:400});
      return;
    }
    let complete = false;
    let status = 0;
    const done = result => {
      if (!complete) { complete = true; resolve(result); }
    };
    const request = session.request({
      ':method':'POST',
      ':path':'/3/device/' + token,
      'authorization':'bearer ' + authToken,
      'apns-topic':config.APNS_BUNDLE_ID,
      'apns-push-type':'alert',
      'apns-priority':'10',
      'apns-expiration':'0',
      'content-type':'application/json'
    });
    const chunks = [];
    request.setEncoding('utf8');
    request.on('response', headers => {status = Number(headers[':status'] || 0);});
    request.on('data', chunk => {if(chunks.join('').length < 2048)chunks.push(chunk);});
    request.on('end', () => {
      let reason = '';
      try {reason = JSON.parse(chunks.join('')).reason || '';} catch {}
      done({
        ok:status===200,
        gone:status===410 || (status===400 && ['BadDeviceToken','DeviceTokenNotForTopic','Unregistered'].includes(reason)),
        status
      });
    });
    request.on('error', () => done({ok:false,gone:false,status:0}));
    request.setTimeout(15000, () => {
      request.close(http2.constants.NGHTTP2_CANCEL);
      done({ok:false,gone:false,status:0});
    });
    request.end(apnsPayload(event,destination));
  });
}
export async function sendNativePushBatch(subscriptions,event,destination,env=process.env) {
  if (!apnsConfigured(env)) return {configured:false,results:[]};
  if (!Array.isArray(subscriptions) || !subscriptions.length) return {configured:true,results:[]};
  const jwt = createApnsProviderToken(env);
  const session = http2.connect('https://api.push.apple.com');
  session.on('error', () => {}); // Individual requests report failures.
  try {
    const results = await Promise.all(subscriptions.slice(0,100).map(async sub => {
      try {
        const delivery = await sendViaSession(
          session,sub.device_token,event,env,jwt,destination
        );
        return {subscription_id:sub.subscription_id,...delivery};
      } catch {
        return {subscription_id:sub.subscription_id,ok:false,gone:false,status:0};
      }
    }));
    return {configured:true,results};
  } finally {
    session.close();
  }
}
