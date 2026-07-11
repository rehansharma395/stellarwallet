export interface UIState {
  isLoading: boolean;
  alertMessage: string | null;
  toast: { message: string; type: 'success' | 'error' } | null;
}

export const initialUIState: UIState = {
  isLoading: true,
  alertMessage: null,
  toast: null,
};

/**
 * Triggers loading skeleton representation.
 */
export function handleInitialLoad(state: UIState): UIState {
  return {
    ...state,
    isLoading: true,
  };
}

/**
 * Resolves loading representation.
 */
export function handleLoadComplete(state: UIState): UIState {
  return {
    ...state,
    isLoading: false,
  };
}

/**
 * Manages state for failed actions, setting custom alert messages and error toasts.
 */
export function handleFailedTransaction(state: UIState, errorMessage: string): UIState {
  return {
    ...state,
    alertMessage: errorMessage,
    toast: {
      message: `Transaction Failed: ${errorMessage}`,
      type: 'error',
    },
  };
}

/**
 * Manages state for successful actions, clearing alert boundaries and setting a success toast.
 */
export function handleSuccessfulTransaction(state: UIState, successMessage: string): UIState {
  return {
    ...state,
    alertMessage: null,
    toast: {
      message: successMessage,
      type: 'success',
    },
  };
}

/**
 * Clears the active toast notification.
 */
export function handleClearToast(state: UIState): UIState {
  return {
    ...state,
    toast: null,
  };
}
