import { describe, test, expect } from 'vitest';
import {
  initialUIState,
  handleInitialLoad,
  handleLoadComplete,
  handleFailedTransaction,
  handleSuccessfulTransaction,
  handleClearToast,
} from '../utils/uiController';

describe('Conduit Frontend E2E & Integration Simulation', () => {
  
  // Requirement 1: Verify the layout loads a proper UI Skeleton while data polling is pending
  test('Layout displays a pending UI skeleton during initial load', () => {
    let state = { ...initialUIState };
    
    // Initial state starts with loading = true
    expect(state.isLoading).toBe(true);
    expect(state.alertMessage).toBeNull();
    expect(state.toast).toBeNull();

    // Trigger initial load step
    state = handleInitialLoad(state);
    expect(state.isLoading).toBe(true);

    // Resolve loading state
    state = handleLoadComplete(state);
    expect(state.isLoading).toBe(false);
  });

  // Requirement 2: Assert that firing a failed transaction correctly displays a custom alert boundary component
  test('Firing a failed transaction triggers a custom alert boundary and error notification toast', () => {
    let state = { ...initialUIState };
    state = handleLoadComplete(state);
    expect(state.isLoading).toBe(false);

    // Trigger a failed transaction (e.g. Campaign Inactive or Unverified Recipient)
    const errorReason = 'UnverifiedRecipient: Recipient is not whitelisted';
    state = handleFailedTransaction(state, errorReason);

    // Assert alert boundary displays the correct message
    expect(state.alertMessage).toBe(errorReason);
    
    // Assert error toast is fired
    expect(state.toast).not.toBeNull();
    expect(state.toast?.type).toBe('error');
    expect(state.toast?.message).toContain(errorReason);
  });

  // Requirement 3: Validate that a successful state alteration accurately fires a reactive Toast notification engine
  test('Firing a successful transaction clears alert boundaries and triggers a success toast notification', () => {
    let state = { ...initialUIState };
    state = handleLoadComplete(state);
    
    // Set a pre-existing error alert to verify it is cleared
    state = handleFailedTransaction(state, 'Some previous error');
    expect(state.alertMessage).not.toBeNull();

    // Trigger successful disbursement transaction
    const successMsg = 'Routed 5,000 USDC to CleanH2O Foundation.';
    state = handleSuccessfulTransaction(state, successMsg);

    // Assert that the alert boundary is cleared (reverts to null)
    expect(state.alertMessage).toBeNull();

    // Assert that the success toast notification is successfully triggered
    expect(state.toast).not.toBeNull();
    expect(state.toast?.type).toBe('success');
    expect(state.toast?.message).toBe(successMsg);

    // Verify toast can be cleared dynamically
    state = handleClearToast(state);
    expect(state.toast).toBeNull();
  });
});
