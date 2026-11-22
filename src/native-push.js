import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// All APNs device registration occurs on the iPhone. This file never reads the
// server's APNS_PRIVATE_KEY; only an opaque device token leaves the phone.
export function nativePushAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}
let initialized = false;
let callbacks = {};
export async function listenNativePush(nextCallbacks) {
  if (!nativePushAvailable()) return;
  callbacks = nextCallbacks;
  if (initialized) return;
  await PushNotifications.addListener('registration', token => {
    void callbacks.onToken?.(token.value);
  });
  await PushNotifications.addListener('registrationError', error => {
    callbacks.onError?.(error?.error || 'Apple push registration failed.');
  });
  await PushNotifications.addListener('pushNotificationReceived', notification => {
    void callbacks.onReceive?.(notification);
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', action => {
    void callbacks.onAction?.(action.notification);
  });
  initialized = true;
}
export async function nativePushPermission() {
  if (!nativePushAvailable()) return 'unavailable';
  const status = await PushNotifications.checkPermissions();
  return status.receive;
}
export async function requestNativePushPermission() {
  const status = await PushNotifications.requestPermissions();
  return status.receive;
}
export async function registerNativePush() {
  return PushNotifications.register();
}
export async function unregisterNativePush() {
  return PushNotifications.unregister();
}
