import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
// Capacitor starts at index.html; preserve the auction as a separate entry point.
copyFileSync('dist-ios/index.html', 'dist-ios/auction.html');
// Startup is explicitly league.html in capacitor.config.json.
// Public install-page links must also work in the bundled app.
const install = readFileSync('dist-ios/install.html', 'utf8').replace('href="/league"', 'href="/league.html"');
writeFileSync('dist-ios/install.html', install);
