# Vite Configuration Guide: CommonJS/ESM Migration

This document explains why our Vite configuration looks complex and provides a systematic approach for handling CommonJS/ESM compatibility issues in blockchain applications.

## 🎯 Context: Why This Configuration Exists

This project migrated from **Webpack to Vite** to achieve:
- ⚡ **Faster development server** (no upfront bundling)
- 🔥 **Instant hot reload** (ESM-based)
- 🎯 **Simpler configuration** (modern defaults)

However, blockchain dependencies (Aztec, crypto packages) were built for **Node.js (CommonJS)** while Vite expects **modern ESM**. This created a systematic compatibility challenge.

## 💥 The Core Problem

```javascript
// CommonJS (Node.js) - What blockchain packages use ❌
module.exports = something
const thing = require('package')

// ESM (Browser/Vite) - What Vite expects ✅  
export default something
import thing from 'package'
```

**Result**: `"does not provide an export named 'default'"` errors during builds.

## 🛠️ Our Systematic Solution

### The Winning Pattern

For each problematic CommonJS package, we create **specific file path aliases**:

```typescript
resolve: {
  alias: {
    'problematic-package': 'problematic-package/path/to/correct/file.js',
  }
}
```

### Why This Works

1. **Bypasses automatic resolution** - Vite uses our exact path
2. **Points to correct file** - Often `/lib/`, `/esm/`, or `/index.js` versions
3. **Enables CommonJS transformation** - Vite can then properly convert exports

## 📋 Step-by-Step: Adding New Problematic Dependencies

### 1. Identify the Error Pattern

Common error messages:
```bash
"does not provide an export named 'default'"
"does not provide an export named 'someFunction'"  
"Missing './some-file.js' specifier"
```

### 2. Investigate the Package Structure

```bash
# Check what files exist in the package
ls node_modules/problematic-package/

# Common locations for correct files:
node_modules/problematic-package/lib/
node_modules/problematic-package/esm/  
node_modules/problematic-package/dist/
node_modules/problematic-package/index.js
```

### 3. Find the Correct Export File

Look for files that contain the actual exports:
```bash
# Check main entry points
cat node_modules/problematic-package/package.json | grep "main\|exports\|browser"

# Look for actual export statements
grep -r "module.exports\|export" node_modules/problematic-package/
```

### 4. Create the Alias

Add to `vite.config.ts`:
```typescript
resolve: {
  alias: {
    'your-problematic-package': 'your-problematic-package/correct/path.js',
  }
}
```

### 5. Test and Iterate

```bash
# Test development server
yarn dev

# Test production build  
yarn build-app
```

If errors persist, try different file paths or add to exclusions.

## 🎯 Real Examples from Our Migration

### Example 1: Basic CommonJS Package
```typescript
// Error: "lodash.chunk does not provide export named 'default'"
// Investigation: Found module.exports = chunk in /index.js
// Solution:
'lodash.chunk': 'lodash.chunk/index.js',
```

### Example 2: Browser vs Node Versions  
```typescript
// Error: "pino does not provide export named 'pino'"
// Investigation: Found browser.js has different exports than main
// Solution:
'pino': 'pino/browser.js', // Use browser-safe version
```

### Example 3: Deep Path Issues
```typescript
// Error: "hash.js does not provide export named 'default'"
// Investigation: Main file is in /lib subdirectory
// Solution:
'hash.js': 'hash.js/lib/hash.js',
```

### Example 4: ESM Package Conflicts
```typescript
// Error: Multiple @noble/hashes errors despite being ESM
// Investigation: Package is modern ESM but bundling conflicts
// Solution: Treat as external dependency
rollupOptions: {
  external: [/@noble\/hashes/],
}
```

## 🧹 Configuration Cleanup Guidelines

While debugging, avoid configuration bloat:

### ❌ Remove When Possible:
- Unused polyfill dependencies
- Overly broad exclusions  
- Manual chunk optimizations (Vite's automatic chunking is excellent)
- Warning suppressions (fix root causes instead)

### ✅ Keep When Essential:
- **Core polyfills**: `buffer`, `crypto`, `util`, `assert`, `process`, `stream`, `path`
- **Specific package aliases** (each solves a real problem)
- **External configurations** for modern ESM packages that conflict

## 🔧 Troubleshooting Decision Tree

```
Package fails to import
├── Is it a CommonJS package? 
│   ├── Yes → Find correct file path → Add alias
│   └── No → Is it modern ESM?
│       ├── Yes → Try external configuration  
│       └── No → Check if polyfill needed
└── Still failing?
    ├── Check for nested dependencies importing it
    ├── Verify file actually exists at alias path
    └── Try excluding from CommonJS transformation
```

## 📊 Current Package Solutions

| Package | Issue Type | Solution Pattern |
|---------|-----------|-----------------|
| `pino` | Browser compatibility | Point to `/browser.js` |
| `hash.js` | Deep exports | Point to `/lib/hash.js` |  
| `sha3` | CommonJS default | Point to `/index.js` |
| `lodash.*` | CommonJS default | Point to each `/index.js` |
| `json-stringify-deterministic` | Deep exports | Point to `/lib/index.js` |
| `@noble/hashes` | ESM bundling conflict | External dependency |

## ⚡ Performance Impact

**Development Server**: ✅ Dramatically faster (ESM native)
**Production Build**: ✅ ~20s for 6,467 modules (excellent for blockchain app)
**Bundle Size**: ✅ Well-optimized with automatic chunking

## 🚨 Warning Signs for New Issues

Watch for these patterns indicating new CommonJS problems:
- `[commonjs--resolver]` errors during build
- `"does not provide an export named"` messages
- Module resolution failures in production (but dev works)
- Circular dependency warnings from CommonJS packages

## 🔄 Extending This Approach

This methodology scales to any CommonJS/ESM compatibility issue:

1. **Follow the error breadcrumbs** - Each fix reveals the next issue
2. **Use the systematic pattern** - File path aliases solve 90% of problems
3. **External for modern packages** - Sometimes not bundling is better
4. **Keep configuration minimal** - Only add what's proven necessary

## 📚 Additional Resources

- [Vite Troubleshooting Guide](https://vite.dev/guide/troubleshooting.html)
- [CommonJS vs ESM Differences](https://nodejs.org/api/esm.html#differences-between-es-modules-and-commonjs)
- [Node.js Polyfills in Browsers](https://github.com/paulmillr/vite-plugin-node-polyfills)

---

*This configuration represents battle-tested solutions to real compatibility problems. Each alias and setting solves a specific issue encountered during migration.*
