# Swap Feature - Files Created & Modified

## New Files (Untracked)

### ABIs
| File | Description |
|------|-------------|
| `src/abi/bridgeSwapHook.json` | ABI for the Bridge Swap Hook contract |
| `src/abi/uniswapRouter.json` | Minimal ABI for Uniswap V2 Router (`getAmountsOut`) |

### Components
| File | Description |
|------|-------------|
| `src/components/Modal.tsx` | Generic modal component |
| `src/components/ModalOption.tsx` | Modal option/item component |
| `src/components/swap/SwapPanel.tsx` | Input panel for swap amounts and token selection |
| `src/components/swap/SwapProgress.tsx` | Visual progress indicator for swap steps |
| `src/components/swap/modals/BridgeSelectModal.tsx` | Bridge selection modal |
| `src/components/swap/modals/ConfirmSwapModal.tsx` | Swap confirmation modal |
| `src/components/swap/modals/ProtocolSelectModal.tsx` | Protocol selection modal |
| `src/components/swap/modals/SettingsModal.tsx` | Slippage settings modal |
| `src/components/swap/modals/TokenSelectModal.tsx` | Token selection modal |
| `src/components/swap/modals/index.ts` | Barrel export for modals |

### Containers
| File | Description |
|------|-------------|
| `src/containers/swap/SwapCard.tsx` | Card wrapper for swap UI |
| `src/containers/swap/SwapForm.tsx` | Main swap form component |
| `src/containers/swap/index.ts` | Barrel export for swap containers |

### Hooks
| File | Description |
|------|-------------|
| `src/hooks/useBridgeSwap.ts` | Orchestrates the bridge swap flow |
| `src/hooks/swap/index.ts` | Barrel export for swap hooks |
| `src/hooks/swap/useBaseSepoliaUniswapQuote.ts` | Fetches Uniswap V2 quotes on Base Sepolia |
| `src/hooks/swap/useSwapFlow.ts` | Manages swap lifecycle state and step transitions |
| `src/hooks/swap/useSwapPair.ts` | Manages token pair selection and amounts |
| `src/hooks/swap/useSwapSettings.ts` | Manages slippage tolerance settings |

---

## Modified Files

### Config
| File | Changes |
|------|---------|
| `src/config/bridgeConstants.ts` | Added `EVM_ORDER_STATUS`, `BRIDGE_SWAP_HOOK_ADDRESS` constants |
| `src/config/networks/testnet.ts` | Network configuration updates |

### Services
| File | Changes |
|------|---------|
| `src/services/aztec/features/AztecBridgeService.ts` | Added `openAztecToEvmOrderForBridgeSwap`, updated `monitorOrderFilling` to use `orderStatus` |
| `src/services/evm/features/EVMBridgeService.ts` | Added `openEvmToAztecOrderForBridgeSwap` with callbacks for step tracking |
| `src/services/aztec/core/AztecOrchestrationService.ts` | Orchestration updates |
| `src/services/aztec/features/AztecTokenService.ts` | Token service updates |

### ABIs
| File | Changes |
|------|---------|
| `src/abi/l2Gateway7683.json` | Updated with correct ABI from BaseScan (added `orderStatus`, fixed event signatures) |

### UI & Styles
| File | Changes |
|------|---------|
| `src/style.css` | Added styles for swap components, modals, slippage settings, progress indicators |
| `src/components/index.ts` | Added exports for new components |
| `src/containers/index.ts` | Added exports for swap containers |
| `src/containers/MainContent.tsx` | Integrated swap UI |
| `src/containers/BridgeCard.tsx` | UI updates |

### Types
| File | Changes |
|------|---------|
| `src/types/bridge.ts` | Bridge type definitions |
| `src/types/ui.ts` | UI type definitions |

### Providers
| File | Changes |
|------|---------|
| `src/providers/AppProvider.tsx` | Provider updates |
| `src/providers/TokenProvider.tsx` | Token provider updates |

### Hooks (Existing)
| File | Changes |
|------|---------|
| `src/hooks/useBridgeIn.ts` | Bridge in hook updates |
| `src/hooks/useWethBalance.ts` | WETH balance hook updates |

### Other
| File | Changes |
|------|---------|
| `package.json` | Dependency updates |
| `yarn.lock` | Lock file updates |

---

## Directory Structure (New)

```
src/
├── abi/
│   ├── bridgeSwapHook.json      (new)
│   └── uniswapRouter.json       (new)
├── components/
│   ├── Modal.tsx                (new)
│   ├── ModalOption.tsx          (new)
│   └── swap/                    (new directory)
│       ├── SwapPanel.tsx
│       ├── SwapProgress.tsx
│       └── modals/
│           ├── BridgeSelectModal.tsx
│           ├── ConfirmSwapModal.tsx
│           ├── ProtocolSelectModal.tsx
│           ├── SettingsModal.tsx
│           ├── TokenSelectModal.tsx
│           └── index.ts
├── containers/
│   └── swap/                    (new directory)
│       ├── SwapCard.tsx
│       ├── SwapForm.tsx
│       └── index.ts
└── hooks/
    ├── useBridgeSwap.ts         (new)
    └── swap/                    (new directory)
        ├── index.ts
        ├── useBaseSepoliaUniswapQuote.ts
        ├── useSwapFlow.ts
        ├── useSwapPair.ts
        └── useSwapSettings.ts
```

