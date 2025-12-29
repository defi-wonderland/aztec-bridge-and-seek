# Temporary Changes Log - Bridge Out Address Selector

> **Purpose**: Allow pasting EVM address manually in Bridge Out (without requiring wallet connection)

---

## New Files (3)

### 1. `src/utils/address.ts`

```typescript
// Functions:
// - isValidEvmAddress(address: string): boolean - validates format 0x + 40 hex chars
// - truncateAddress(address: string, startChars = 6, endChars = 4): string
```

### 2. `src/components/AddressInputModal.tsx`

```typescript
// Props:
// - isOpen: boolean
// - onClose: () => void
// - onConfirm: (address: string) => void
// - onConnectWallet: () => void
// - currentAddress?: string
// - isWalletConnected?: boolean
// - connectedWalletAddress?: string

// Features:
// - Input to paste EVM address
// - Validation with isValidEvmAddress
// - "Done" button to confirm
// - "or" divider
// - Button to use connected wallet or connect wallet
// - Closes with Escape key or click outside
```

### 3. `src/components/AddressSelector.tsx`

```typescript
// Props:
// - address?: string
// - placeholder?: string (default: 'Select address')
// - onClick: () => void
// - className?: string
// - disabled?: boolean

// Features:
// - Clickable button that shows truncated address or placeholder
// - Icon ✎ if has address, ↓ if empty
```

---

## Modified Files (5)

### 1. `src/utils/index.ts`

**Change**: Added export for new utilities

```typescript
export { isValidEvmAddress, truncateAddress } from './address';
```

### 2. `src/components/index.ts`

**Change**: Added export for new components

```typescript
export { AddressInputModal } from './AddressInputModal';
export { AddressSelector } from './AddressSelector';
```

### 3. `src/hooks/useBridgeOut.ts`

**Main changes**:

- Removed import of `useEVMWallet` (no longer needed)
- Added import: `import { isValidEvmAddress } from '../utils/address';`
- Changed `bridgeOut` signature:

  ```typescript
  // BEFORE:
  const bridgeOut = async (amount: string, privateBalance: bigint) => {

  // AFTER:
  const bridgeOut = async (
    amount: string,
    privateBalance: bigint,
    recipientAddress: string  // ← NEW PARAMETER
  ) => {
  ```

- Changed validation: no longer validates `evmAccount?.address`, validates `recipientAddress` with `isValidEvmAddress`
- In call to `bridgeService.openAztecToEvmOrder`: changed `evmAccount.address` to `recipientAddress`

### 4. `src/containers/BridgeForm.tsx`

**Main changes**:

**Added imports**:

```typescript
import { AddressInputModal, AddressSelector } from '../components';
```

**New state** (after `const [amount, setAmount]`):

```typescript
const [customRecipientAddress, setCustomRecipientAddress] = useState<
  string | null
>(null);
const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
```

**New variable** (before config):

```typescript
const bridgeOutRecipient = customRecipientAddress || evmAccount?.address;
```

**Modified config** - `toAddress` in bridge out:

```typescript
// BEFORE:
toAddress: evmAccount?.address,

// AFTER:
toAddress: bridgeOutRecipient,
```

**Modified handleBridge**:

```typescript
// BEFORE:
await bridgeOut(amount, sourceBalance);

// AFTER:
if (!bridgeOutRecipient) return;
await bridgeOut(amount, sourceBalance, bridgeOutRecipient);
```

**Modified isConnected**:

```typescript
// BEFORE:
const isConnected = evmAccount?.isConnected && aztecAccount;

// AFTER:
const isConnected =
  direction === 'out'
    ? aztecAccount && Boolean(bridgeOutRecipient)
    : evmAccount?.isConnected && aztecAccount;
```

**Modified "TO" field UI** (in route-endpoint):

```tsx
// BEFORE: showed "Connect EVM Wallet" button in Bridge Out

// AFTER: in Bridge Out shows AddressSelector
{direction === 'out' ? (
  <AddressSelector
    address={bridgeOutRecipient}
    placeholder="Enter recipient address"
    onClick={() => setIsAddressModalOpen(true)}
    disabled={isBridging}
  />
) : /* Bridge In stays the same */ }
```

**Modified main button**:

```tsx
// Added case for Bridge Out without recipient:
{
  !isBridging &&
    aztecAccount &&
    direction === 'out' &&
    !bridgeOutRecipient &&
    'Select Recipient';
}

// Changed EVM wallet condition to Bridge In only:
{
  !isBridging &&
    aztecAccount &&
    direction === 'in' &&
    !evmAccount?.isConnected &&
    'Connect EVM Wallet';
}
```

**Added modal** (before closing `</div>`):

```tsx
<AddressInputModal
  isOpen={isAddressModalOpen}
  onClose={() => setIsAddressModalOpen(false)}
  onConfirm={(address) => setCustomRecipientAddress(address)}
  onConnectWallet={connectEVM}
  currentAddress={customRecipientAddress || ''}
  isWalletConnected={evmAccount?.isConnected}
  connectedWalletAddress={evmAccount?.address}
/>
```

**Network warning** - Bridge In only:

```tsx
// BEFORE:
{!isSupported && (

// AFTER:
{direction === 'in' && !isSupported && (
```

### 5. `src/style.css`

**Change**: Added ~300 lines at the end of the file

New classes:

- `.address-selector` and variants
- `.address-modal-overlay`
- `.address-modal`
- `.address-modal-header`, `.address-modal-title`, `.address-modal-close`
- `.address-modal-content`
- `.address-modal-input-section`, `.address-modal-label`, `.address-modal-input`
- `.address-modal-error`
- `.address-modal-confirm-btn`
- `.address-modal-divider`
- `.address-modal-wallet-section`, `.address-modal-wallet-btn`
- `.wallet-icon`, `.wallet-text`, `.wallet-address`
- Responsive media query for modal

---

## Verification Commands After Merge

```bash
# TypeScript must compile without errors
npx tsc --noEmit

# Check new files exist
ls src/utils/address.ts
ls src/components/AddressInputModal.tsx
ls src/components/AddressSelector.tsx

# Verify exports exist
grep "AddressInputModal" src/components/index.ts
grep "isValidEvmAddress" src/utils/index.ts

# Verify bridgeOut signature
grep "recipientAddress: string" src/hooks/useBridgeOut.ts

# Verify modal in BridgeForm
grep "AddressInputModal" src/containers/BridgeForm.tsx
grep "customRecipientAddress" src/containers/BridgeForm.tsx
```

---

## Expected Behavior

**Bridge Out**:

1. "TO" field shows AddressSelector with "Enter recipient address"
2. Click → opens modal
3. User can: paste address OR connect/use wallet
4. Does NOT require EVM wallet connected to bridge

**Bridge In**:

- No changes, still requires EVM wallet connected (must sign transaction)
