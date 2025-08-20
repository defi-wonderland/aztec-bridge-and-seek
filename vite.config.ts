import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Include specific polyfills that your Webpack config provided
      include: ['buffer', 'crypto', 'util', 'assert', 'process', 'stream', 'path'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Additional polyfills for blockchain dependencies
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util',
      path: 'path-browserify',
      // Use browser-safe pino version
      'pino': 'pino/browser.js',
      // Force specific hash.js path for proper CommonJS handling
      'hash.js': 'hash.js/lib/hash.js',
      // Fix sha3 CommonJS exports
      'sha3': 'sha3/index.js',
      // Fix lodash.chunk CommonJS exports
      'lodash.chunk': 'lodash.chunk/index.js',
      // Fix lodash.times CommonJS exports
      'lodash.times': 'lodash.times/index.js',
      // Fix lodash.isequal CommonJS exports
      'lodash.isequal': 'lodash.isequal/index.js',
      // Fix json-stringify-deterministic CommonJS exports
      'json-stringify-deterministic': 'json-stringify-deterministic/lib/index.js',


    },
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
      exclude: [/@noble\/hashes/],
      transformMixedEsModules: true,
      defaultIsModuleExports: true,
    },
    rollupOptions: {
      external: [/@noble\/hashes/],
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'buffer',
      'crypto-browserify',
      'stream-browserify',
      'util',
      'path-browserify',
    ],
    // Exclude problematic dependencies from pre-bundling
    exclude: [
      '@aztec/aztec.js', 
      '@aztec/foundation',
      '@aztec/bb.js',
      '@aztec/telemetry-client',
      '@noble/hashes',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
