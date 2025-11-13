import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nobleAssertReplacement = resolve(__dirname, 'src/polyfills/noble-assert.ts');

const nobleAssertPolyfill = () => {
  return {
    name: 'noble-assert-polyfill',
    enforce: 'pre',
    resolveId(source: string, importer?: string) {
      if (source === '@noble/hashes/esm/_assert.js') {
        return nobleAssertReplacement;
      }
      if (
        source === './_assert.js' &&
        importer?.includes('@noble/hashes/esm/utils.js')
      ) {
        return nobleAssertReplacement;
      }
      return null;
    },
  };
};

const nobleAssertEsbuildPlugin = () => ({
  name: 'noble-assert-esbuild',
  setup(build) {
    build.onResolve({ filter: /@noble\/hashes\/esm\/_assert\.js$/ }, () => ({
      path: nobleAssertReplacement,
    }));
    build.onResolve({ filter: /^\.\/_assert\.js$/ }, (args) => {
      if (args.importer.includes('/@noble/hashes/esm/utils.js')) {
        return { path: nobleAssertReplacement };
      }
      return undefined;
    });
  },
});

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      // Include specific polyfills that your Webpack config provided
      include: ['buffer', 'crypto', 'util', 'assert', 'process', 'stream', 'path', 'url', 'events'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    nobleAssertPolyfill(),
  ],
  assetsInclude: ['**/*.wasm'],
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
      '@metamask/sdk': resolve(__dirname, 'src/polyfills/metamask-sdk.ts'),
      '@noble/hashes/esm/_assert.js': resolve(__dirname, 'src/polyfills/noble-assert.ts'),
      // Stub out native Node.js build tools (not available in browser)
      'node-gyp-build': '/src/polyfills/node-gyp-stub.ts',
      'node-gyp-build-optional-packages': '/src/polyfills/node-gyp-stub.ts',
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
    dedupe: [
      '@aztec/foundation',
      '@aztec/circuits.js',
      '@noble/hashes',
      '@noble/curves',
      '@aztec/aztec.js',
      'ethereum-cryptography',
    ],
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
    sourcemap: false, // Disable sourcemaps to reduce memory usage
    minify: 'esbuild',
    chunkSizeWarningLimit: 2000, // Increase chunk size warning limit
    commonjsOptions: {
      // Forces @aztec packages to be treated as ESM to prevent class identity errors
      defaultIsModuleExports: (id) => {
        if (id.includes('@aztec/')) {
          return false;
        }
        return 'auto';
      },
    },
    rollupOptions: {
      output: {
        format: 'es',
        preserveModules: false,
        inlineDynamicImports: false,
        interop: 'auto',
        assetFileNames: (assetInfo) => {
          if ((assetInfo as any).name?.endsWith('.wasm')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'buffer',
      'crypto-browserify',
      'stream-browserify',
      'util',
      'path-browserify',
      '@rainbow-me/rainbowkit',
      '@tanstack/react-query',
      'wagmi',
      'viem',
    ],
    exclude: [
      '@aztec/bb.js',
      '@aztec/pxe',
      '@aztec/pxe/client/lazy',
      '@aztec/foundation',
      '@aztec/aztec.js',
      '@aztec/circuits.js',
      '@aztec/noir-contracts.js',
      '@defi-wonderland/aztec-standards',
      'noirc_abi_wasm',
      '@substancelabs/aztec-evm-bridge-sdk',
      'ethereum-cryptography',
      '@noble/hashes',
      '@noble/curves',
    ],
    esbuildOptions: {
      plugins: [nobleAssertEsbuildPlugin()],
    },
  },
});
