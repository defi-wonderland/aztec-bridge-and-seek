# Aztec eth95 Replication Plan

## Overview
Replicate the functionality of [eth95](https://github.com/adrianmcli/eth95) for Aztec contracts. This tool allows users to input an on-chain Aztec contract address and its artifact to generate a dynamic UI for contract interaction, similar to Etherscan's contract function interaction capabilities.

## Development Approach
- **Systematic, step-by-step implementation**
- **Test-driven development**: Write logic → Review → Write tests → Pass tests → Move to next phase
- **Unit tests**: Vitest (separated in `/tests/vitest/`)
- **E2E tests**: Playwright (separated in `/tests/playwright/`)
- **TypeScript guidelines**: Following workspace rules for development and testing

## Phase 1: Core Backend Logic ✅

### ✅ Step 1: Contract Types
- **File**: `src/types/contracts.ts`
- **Purpose**: Define TypeScript interfaces for Aztec contract metadata, functions, and parameters
- **Status**: COMPLETED

### ✅ Step 2: Artifact Parser Service
- **File**: `src/services/aztec/artifacts/AztecArtifactService.ts`
- **Purpose**: Parse raw contract artifacts (JSON) into structured metadata
- **Key Features**:
  - Parse function metadata and parameters
  - Determine function visibility (private/public/unconstrained)
  - Handle Aztec-specific types (AztecAddress, Field, etc.)
  - Support for initializer functions (Aztec's constructor equivalent)
- **Tests**: `tests/vitest/aztec_artifact_service.test.ts`
- **Status**: COMPLETED

### ✅ Step 3: UI Configuration Generator
- **File**: `src/services/aztec/ui/ContractUIGenerator.ts`
- **Purpose**: Generate UI configurations from parsed contract metadata
- **Key Features**:
  - Categorize functions by visibility and type
  - Generate form field configurations for parameters
  - Handle Aztec's unique initializer pattern (multiple/optional initializers)
  - Provide UI hints (icons, colors, descriptions)
- **Tests**: 
  - Unit: `tests/vitest/contract_ui_generator.test.ts`
  - E2E: `tests/playwright/contract_ui_generator.spec.ts`
- **Status**: COMPLETED

### ✅ Step 4: Contract Interaction Service
- **File**: `src/services/aztec/interaction/contract_interaction_service.ts`
- **Purpose**: Handle execution of contract functions and deployment
- **Key Features**:
  - Execute private, public, and unconstrained functions
  - Deploy contracts with optional initializers
  - Input validation and type conversion
  - Block number tracking for transactions
  - Comprehensive error handling
- **Tests**: `tests/vitest/contract_interaction_service.test.ts`
- **Status**: COMPLETED ✅ (Updated to use block numbers instead of timestamps)

### 📋 Step 5: Enhance AztecContractService
- **File**: `src/services/aztec/core/AztecContractService.ts`
- **Purpose**: Integrate new services with existing contract management
- **Current State**: Basic contract registration and deployment parameter handling
- **Tasks**:
  - Integrate `AztecArtifactService` for artifact parsing
  - Integrate `ContractUIGenerator` for UI configuration generation
  - Integrate `ContractInteractionService` for function execution
  - Add methods like `parseContractArtifact()`, `generateContractUI()`, `executeContractFunction()`
  - Bridge between raw artifacts and our new service layer
- **Status**: PENDING

### 📋 Step 6: Integration Tests
- **Purpose**: End-to-end testing of Phase 1 components working together
- **Tasks**:
  - Test artifact → metadata → UI config → interaction flow
  - Test with real Aztec contract artifacts
  - Validate error handling across services
- **Status**: PENDING

## Phase 2: Frontend Components

### Step 1: Dynamic Form Components
- **Files**: 
  - `src/components/contract/DynamicContractForm.tsx`
  - `src/components/contract/ParameterInput.tsx`
- **Purpose**: Render dynamic forms based on UI configurations
- **Features**:
  - Support all Aztec parameter types
  - Real-time validation
  - Responsive design

### Step 2: Function Execution Interface
- **Files**:
  - `src/components/contract/FunctionExecutor.tsx`
  - `src/components/contract/ExecutionResults.tsx`
- **Purpose**: Interface for executing contract functions
- **Features**:
  - Function categorization (private/public/unconstrained)
  - Execution progress indicators
  - Result display with transaction details

### Step 3: Contract Browser
- **Files**:
  - `src/components/contract/ContractBrowser.tsx`
  - `src/components/contract/ContractInput.tsx`
- **Purpose**: Main interface for inputting contract address and artifact
- **Features**:
  - Address validation
  - Artifact upload/paste functionality
  - Contract metadata display

## Phase 3: Integration & Polish

### Step 1: State Management
- **Files**: 
  - `src/hooks/useContract.ts`
  - `src/providers/ContractProvider.tsx`
- **Purpose**: Manage contract state across components

### Step 2: UI/UX Enhancements
- **Tasks**:
  - Responsive design
  - Loading states
  - Error boundaries
  - Accessibility improvements

### Step 3: Documentation & Testing
- **Tasks**:
  - Comprehensive E2E tests
  - User documentation
  - Code documentation
  - Performance optimization

## Current Status

### ✅ COMPLETED (Phase 1)
- Contract types definition
- Artifact parsing service with comprehensive tests
- UI configuration generator with unit and E2E tests  
- Contract interaction service with block number tracking
- All unit tests passing (68/68)

### 🚧 IN PROGRESS
- Ready to enhance AztecContractService
- Ready for Phase 1 integration tests

### 📋 NEXT STEPS
1. Complete Phase 1 Step 5: Enhance AztecContractService
2. Complete Phase 1 Step 6: Integration tests
3. Begin Phase 2: Frontend component development

## Key Design Decisions

### Aztec-Specific Considerations
- **Initializers**: Aztec contracts can have multiple or no initializer functions (unlike EVM constructors)
- **Function Visibility**: Private, public, and unconstrained functions have different execution patterns
- **Type System**: Aztec uses specific types (Field, AztecAddress, etc.) that need special handling
- **Block Numbers**: Using block numbers instead of timestamps for better blockchain integration

### Testing Strategy
- **Unit Tests**: Vitest for isolated component testing
- **E2E Tests**: Playwright for full user journey testing
- **Real Artifacts**: Using actual Aztec contract artifacts for realistic testing
- **Separation**: Clear separation between unit and E2E test directories

### Architecture
- **Service Layer**: Clean separation of concerns with dedicated services
- **Type Safety**: Comprehensive TypeScript interfaces for all data structures
- **Error Handling**: Graceful error handling with user-friendly messages
- **Modularity**: Each service can be tested and used independently
