import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/glsk-email-notifications-v1.sql', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/league.js', import.meta.url), 'utf8');
const webhook = readFileSync(new URL('../api/push-event.js', import.meta.url), 'utf8');

assert.match(sql, /create table if not exists public\.league_email_preferences/);
assert.match(sql, /enabled boolean not null default false/);
assert.match(sql, /v_user uuid:=auth\.uid\(\)/);
assert.match(sql, /join auth\.users u on u\.id=a\.user_id/);
assert.match(sql, /u\.email_confirmed_at is not null/);
assert.match(sql, /unique\(event_id,user_id\)/);
assert.match(sql, /on conflict\(event_id,user_id\) do nothing/);
assert.match(sql, /a\.active=true/);
assert.match(sql, /p\.enabled=true/);
assert.match(sql, /create or replace function public\.league_email_delivery_report/);
assert.match(sql, /p_webhook_secret/);

assert.match(ui, /notification-email-toggle/);
assert.match(ui, /league_get_email_preferences/);
assert.match(ui, /league_set_email_preference/);
assert.match(ui, /Email Alerts/);
assert.match(webhook, /process\.env\.RESEND_API_KEY && process\.env\.GLSK_EMAIL_FROM/);
assert.match(webhook, /league_email_delivery_claim/);
assert.match(webhook, /league_email_delivery_report/);
console.log('GLSK email alert safety checks passed');
