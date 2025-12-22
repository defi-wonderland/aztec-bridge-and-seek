import { useState, useEffect, useCallback, useRef } from 'react';
import {
  contractRegistryService,
  ContractGroup,
} from '../services/aztec/core/ContractRegistryService';
import { TabType } from '../types';

interface UseContractRegistryState {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  registeredContracts: ContractGroup[];
}

interface UseContractRegistryReturn extends UseContractRegistryState {
  registerForTab: (tab: TabType) => Promise<void>;
  areContractsReadyForTab: (tab: TabType) => boolean;
}

export const useContractRegistry = (): UseContractRegistryReturn => {
  const [state, setState] = useState<UseContractRegistryState>({
    isLoading: false,
    isReady: contractRegistryService.isInitialized(),
    error: null,
    registeredContracts: contractRegistryService.getRegisteredContracts(),
  });

  const registrationPromises = useRef<Map<TabType, Promise<void>>>(new Map());

  const updateState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isReady: contractRegistryService.isInitialized(),
      registeredContracts: contractRegistryService.getRegisteredContracts(),
    }));
  }, []);

  const registerForTab = useCallback(
    async (tab: TabType): Promise<void> => {
      if (!contractRegistryService.isInitialized()) {
        setState((prev) => ({
          ...prev,
          error:
            'Contract registry not initialized - wallet may not be connected',
        }));
        return;
      }

      if (contractRegistryService.areContractsRegisteredForTab(tab)) {
        updateState();
        return;
      }

      const existingPromise = registrationPromises.current.get(tab);
      if (existingPromise) {
        return existingPromise;
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      const registrationPromise = (async () => {
        try {
          await contractRegistryService.registerForTab(tab);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: null,
            registeredContracts:
              contractRegistryService.getRegisteredContracts(),
          }));
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to register contracts';
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: errorMessage,
          }));
        } finally {
          registrationPromises.current.delete(tab);
        }
      })();

      registrationPromises.current.set(tab, registrationPromise);
      return registrationPromise;
    },
    [updateState]
  );

  const areContractsReadyForTab = useCallback((tab: TabType): boolean => {
    return contractRegistryService.areContractsRegisteredForTab(tab);
  }, []);

  useEffect(() => {
    updateState();
  }, [updateState]);

  return {
    ...state,
    registerForTab,
    areContractsReadyForTab,
  };
};

export const useTabContracts = (tab: TabType, isInitialized: boolean) => {
  const { registerForTab } = useContractRegistry();

  const contractsProcessed =
    contractRegistryService.areContractsProcessedForTab(tab);
  const contractsReady =
    contractRegistryService.areContractsRegisteredForTab(tab);
  const isLoading = isInitialized && !contractsProcessed;
  const hasErrors = contractsProcessed && !contractsReady;

  useEffect(() => {
    if (isInitialized && !contractsProcessed) {
      registerForTab(tab);
    }
  }, [isInitialized, contractsProcessed, registerForTab, tab]);

  return {
    contractsReady,
    isLoading,
    hasErrors,
    retry: () => registerForTab(tab),
  };
};
