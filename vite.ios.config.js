import { mergeConfig } from 'vite';
import webConfig from './vite.config.js';
export default mergeConfig(webConfig, {
  build: { outDir: 'dist-ios' },
  plugins: [{
    name: 'glsk-native-entry',
    transformIndexHtml: { order: 'pre', handler(html) {
      return html.replace('<head>', '<head><script type="module" src="/src/native-runtime.js"></script>');
    } },
  }],
});
