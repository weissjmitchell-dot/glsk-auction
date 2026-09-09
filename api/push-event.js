import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vavzeyewfipswyxeqdht.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vFPh7D0LYQ0n66n_jbBOKA_qTvpXsPq';

const b64url = input => Buffer.from(input).toString('base64url');
const fromB64url = input => Buffer.from(String(input || ''), 'base64url');

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function hkdfExtract(salt, ikm) {
  return crypto.createHmac('sha256', salt).update(ikm).digest();
}
function hkdfExpand(prk, info, length) {
  let previous = Buffer.alloc(0), out = Buffer.alloc(0), counter = 1;
  while (out.length < length) {
    previous = crypto.createHmac('sha256', prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest();
    out = Buffer.concat([out, previous]);
    counter += 1;
  }
  return out.subarray(0, length);
}
function vapidToken(endpoint, publicKey, privateKey, subject) {
  const pub = fromB64url(publicKey);
  const priv = fromB64url(privateKey);
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) throw new Error('Invalid VAPID keys');

  const key = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: b64url(priv)
    },
    format: 'jwk'
  });

  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject
  }));
  const input = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64url(sig)}`;
}
function encryptPayload(sub, payload) {
  const receiverPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  if (receiverPublic.length !== 65 || receiverPublic[0] !== 4) throw new Error('Invalid subscription key');

  const sender = crypto.createECDH('prime256v1');
  sender.generateKeys();
  const senderPublic = sender.getPublicKey();
  const shared = sender.computeSecret(receiverPublic);

  const prkKey = hkdfExtract(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), receiverPublic, senderPublic]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.randomBytes(16);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0'), 12);

  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([senderPublic.length]), senderPublic, ciphertext]);
}
async function rpc(name, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
  return r.json();
}
function destination(event) {
  const type = String(event.event_type || '');
  const category = String(event.category || '');
  if (type === 'auction') return '/';
  if (type === 'supplemental') return '/supplemental';
  if (type === 'phase3') return '/phase3';
  if (category === 'trades') return '/league?tab=trades';
  if (category === 'league_chat') return '/league?tab=chat';
  if (category === 'message_board') return '/league?tab=board';
  if (category === 'matchups') return '/league?tab=matchups';
  if (category === 'deadlines') return '/league?tab=deadlines';
  if (['contracts','rookie_rights','roster_moves','drafts'].includes(category)) return '/league?tab=transactions';
  if (['injuries','player_availability'].includes(category)) return '/league?tab=lineup';
  return '/league?tab=notifications';
}
async function sendOne(sub, event, config) {
  const payload = JSON.stringify({
    title: event.title || 'GLSK',
    body: event.body || 'New league activity',
    url: destination(event),
    tag: `glsk-event-${event.id}`,
    eventId: event.id
  });

  const body = encryptPayload(sub, payload);
  const token = vapidToken(sub.endpoint, config.publicKey, config.privateKey, config.subject);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: ['trades','injuries'].includes(event.category) ? 'high' : 'normal',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${token}, k=${config.publicKey}`
    },
    body
  });

  return { ok: r.status === 201 || r.status === 202, gone: r.status === 404 || r.status === 410, status: r.status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'https://glsk-auction.vercel.app';

  if (!secret || !publicKey || !privateKey) return res.status(503).json({ error: 'Push environment variables are not configured' });
  if (!safeEqual(req.body?.secret, secret)) return res.status(401).json({ error: 'Unauthorized' });

  const eventId = Number(req.body?.event_id);
  if (!Number.isFinite(eventId) || eventId <= 0) return res.status(400).json({ error: 'Invalid event id' });

  try {
    const delivery = await rpc('league_push_delivery_payload', { p_event_id: eventId, p_webhook_secret: req.body.secret });
    if (!delivery?.ok) return res.status(404).json({ error: delivery?.error || 'Event unavailable' });

    const event = delivery.event || {};
    const subscriptions = delivery.subscriptions || [];
    const config = { publicKey, privateKey, subject };

    const results = await Promise.allSettled(subscriptions.map(async sub => {
      let result;
      try { result = await sendOne(sub, event, config); }
      catch { result = { ok: false, gone: false, status: 0 }; }

      try {
        await rpc('league_push_report_delivery', {
          p_webhook_secret: req.body.secret,
          p_subscription_id: sub.subscription_id,
          p_success: result.ok,
          p_gone: result.gone
        });
      } catch {}
      return result;
    }));

    const sent = results.filter(x => x.status === 'fulfilled' && x.value.ok).length;
    return res.status(200).json({ ok: true, eventId, recipients: subscriptions.length, sent, failed: subscriptions.length - sent });
  } catch (error) {
    console.error('GLSK push event failed', error);
    return res.status(500).json({ error: 'Push delivery failed' });
  }
}
