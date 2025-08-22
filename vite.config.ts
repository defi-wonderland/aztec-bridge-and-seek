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
    // Dedupe critical packages to prevent class identity issues
    dedupe: ['@aztec/foundation', '@aztec/circuits.js', '@noble/hashes', '@noble/curves'],
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
    target: 'esnext',
    minify: 'esbuild',
    esbuild: {
      keepNames: true,  // Critical: prevents class constructor minification
      minifyIdentifiers: false,  // Critical: prevents identifier minification that breaks classes
    },
    commonjsOptions: {
      include: [/node_modules/],
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
      // Dedupe to prevent duplicate class instances
      treeshake: {
        moduleSideEffects: true,
      },
      output: {
        // Preserve class names to avoid minification issues
        preserveModules: false,
        generatedCode: {
          constBindings: true,
        },
        assetFileNames: (assetInfo) => {
          if ((assetInfo as any).name?.endsWith('.wasm')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: (id) => {
          // Keep WASM-related modules in separate chunks for better caching
          if (id.includes('noirc_abi_wasm') || id.includes('.wasm')) {
            return 'wasm';
          }
          // Keep @noble packages together to prevent class splitting
          if (id.includes('@noble/')) {
            return 'noble-crypto';
          }
          // Keep core Aztec packages together
          if (id.includes('@aztec/')) {
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
    exclude: [
      '@noble/hashes',
      '@noble/curves',
    ],
    // Force esbuild to handle these packages specially
    esbuildOptions: {
      target: 'esnext',
      // Keep class names to prevent minification issues
      keepNames: true,
    },
  },
});
