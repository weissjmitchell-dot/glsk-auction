import { copyFileSync } from 'node:fs';
// Capacitor starts at index.html; preserve the auction as a separate entry point.
copyFileSync('dist-ios/index.html', 'dist-ios/auction.html');
