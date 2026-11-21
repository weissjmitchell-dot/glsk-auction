import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { apnsConfigured, createApnsProviderToken, sendNativePushBatch } from '../api/_apns.js';

const read = path => readFileSync(path,'utf8');
assert.equal(apnsConfigured({}),false);
assert.deepEqual(await sendNativePushBatch([],{},'/league',{}),{configured:false,results:[]});

const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const env={
  APNS_TEAM_ID:'TESTTEAM12',
  APNS_KEY_ID:'TESTKEY123',
  APNS_BUNDLE_ID:'com.mitchellweiss.glsk',
  APNS_PRIVATE_KEY:privateKey.export({format:'pem',type:'pkcs8'})
};
assert.equal(apnsConfigured(env),true);
const value=createApnsProviderToken(env,1795260000000);
assert.equal(value.split('.').length,3);
const [header,claims,signature]=value.split('.');
assert.deepEqual(JSON.parse(Buffer.from(header,'base64url').toString()),{alg:'ES256',kid:env.APNS_KEY_ID});
assert.equal(JSON.parse(Buffer.from(claims,'base64url').toString()).iss,env.APNS_TEAM_ID);
assert.equal(crypto.verify('sha256',Buffer.from(header+'.'+claims),{
  key:publicKey,dsaEncoding:'ieee-p1363'
},Buffer.from(signature,'base64url')),true);
assert.equal(createApnsProviderToken(env,1795260000000+60_000),value,'APNs JWT reused without excessive rotation');

const sql=read('supabase/glsk-native-apns-v1.sql');
assert.match(sql,/auth\.uid\(\)/,'Native subscription registration must authenticate owners');
assert.match(sql,/league_native_push_delivery_payload/);
assert.match(sql,/league_push_delivery_payload\(p_event_id,p_webhook_secret\)/,
  'Native event delivery must reuse the existing authenticated webhook');
assert.match(sql,/row level security/);
const runtime=read('src/league.js');
assert.match(runtime,/nativePushAvailable\(\)/);
assert.match(runtime,/league_owner_save_native_push_token/);
assert.match(runtime,/iPhone notification permission disabled/);
assert.match(read('src/native-push.js'),/PushNotifications\.register/);
assert.match(read('ios/App/App/AppDelegate.swift'),/capacitorDidRegisterForRemoteNotifications/);
assert.match(read('ios/App/App/App.entitlements'),/aps-environment/);
assert.match(read('scripts/configure-ios.py'),/MARKETING_VERSION = 1\.3\.0/);
assert.match(read('api/push-event.js'),/sendNativePushBatch/);
console.log('PASS native APNs JWT, credential guard, authentication, iOS registration, version, event integration');
