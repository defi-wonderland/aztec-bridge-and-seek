import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
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
  worker: {
    format: 'es',
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
      // Additional headers for WASM support
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    fs: {
      allow: ['..'],
    },
  },
  build: {
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
      exclude: [/@noble\/hashes/],
      transformMixedEsModules: true,
      defaultIsModuleExports: (id) => {
        // Handle WASM modules specially
        if (id.includes('noirc_abi_wasm') || id.includes('wasm')) {
          return false;
        }
        return 'auto';
      },
    },
    rollupOptions: {
      external: [/@noble\/hashes/],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: (id) => {
          // Keep WASM-related modules in separate chunks for better caching
          if (id.includes('noirc_abi_wasm') || id.includes('.wasm')) {
            return 'wasm';
          }
          if (id.includes('@aztec/') && (id.includes('accounts') || id.includes('pxe'))) {
            return 'aztec-core';
          }
        },
      },
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
      '@aztec/accounts',
      '@aztec/pxe',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
