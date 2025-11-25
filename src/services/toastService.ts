/**
 * Toast Service
 * Centralized toast notifications using react-toastify
 */

import { toast, ToastOptions, Id } from 'react-toastify';

const defaultOptions: ToastOptions = {
  position: 'bottom-right',
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export const toastService = {
  /**
   * Success toast
   */
  success: (message: string, options?: ToastOptions): Id => {
    return toast.success(message, {
      ...defaultOptions,
      ...options,
    });
  },

  /**
   * Error toast
   */
  error: (message: string, options?: ToastOptions): Id => {
    return toast.error(message, {
      ...defaultOptions,
      autoClose: 7000, // Errors stay longer
      ...options,
    });
  },

  /**
   * Info toast
   */
  info: (message: string, options?: ToastOptions): Id => {
    return toast.info(message, {
      ...defaultOptions,
      ...options,
    });
  },

  /**
   * Warning toast
   */
  warning: (message: string, options?: ToastOptions): Id => {
    return toast.warning(message, {
      ...defaultOptions,
      ...options,
    });
  },

  /**
   * Loading toast (promise-based)
   */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      pending: string;
      success: string;
      error: string;
    },
    options?: ToastOptions
  ): Promise<T> => {
    return toast.promise(promise, messages, {
      ...defaultOptions,
      ...options,
    }) as Promise<T>;
  },

  /**
   * Loading toast (manual control)
   */
  loading: (message: string, options?: ToastOptions): Id => {
    return toast.loading(message, {
      ...defaultOptions,
      ...options,
    });
  },

  /**
   * Update existing toast
   */
  update: (toastId: Id, options: ToastOptions): void => {
    toast.update(toastId, options);
  },

  /**
   * Dismiss toast
   */
  dismiss: (toastId?: Id): void => {
    toast.dismiss(toastId);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: (): void => {
    toast.dismiss();
  },
};

// PXE-specific toast helpers
export const pxeToasts = {
  /**
   * PXE initialization
   */
  init: (stage: 'start' | 'success' | 'error', error?: string) => {
    switch (stage) {
      case 'start':
        return toastService.loading('🔄 Initializing PXE...');
      case 'success':
        return toastService.success('✅ PXE initialized successfully');
      case 'error':
        return toastService.error(`❌ PXE initialization failed: ${error}`);
    }
  },

  /**
   * Contract registration
   */
  contracts: (
    stage: 'start' | 'success' | 'error',
    count?: number,
    duration?: number
  ) => {
    switch (stage) {
      case 'start':
        return toastService.loading(`📝 Registering ${count} contracts...`);
      case 'success':
        return toastService.success(
          `✅ ${count} contracts registered in ${duration}ms`,
          {
            autoClose: 3000,
          }
        );
      case 'error':
        return toastService.error('❌ Contract registration failed');
    }
  },

  /**
   * Account connection
   */
  account: (stage: 'connecting' | 'connected' | 'error', address?: string) => {
    switch (stage) {
      case 'connecting':
        return toastService.loading('🔐 Connecting account...');
      case 'connected':
        return toastService.success(
          `✅ Connected: ${address?.slice(0, 10)}...`,
          {
            autoClose: 3000,
          }
        );
      case 'error':
        return toastService.error('❌ Failed to connect account');
    }
  },

  /**
   * Balance loading
   */
  balance: (stage: 'loading' | 'loaded' | 'error', duration?: number) => {
    switch (stage) {
      case 'loading':
        return toastService.loading('💰 Loading balance...');
      case 'loaded':
        return toastService.success(`✅ Balance loaded in ${duration}ms`, {
          autoClose: 2000,
        });
      case 'error':
        return toastService.error('❌ Failed to load balance');
    }
  },
};
