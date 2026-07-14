/* eslint-disable @typescript-eslint/no-explicit-any */
let isInitialized = false;

/**
 * Dynamically imports, initializes (if not already), and returns the static
 * StellarWalletsKit class reference on the client side only.
 */
export async function getStellarWalletsKit(): Promise<any> {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const { StellarWalletsKit, Networks } = await import('@creit.tech/stellar-wallets-kit');
  const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');
  
  if (!isInitialized) {
    StellarWalletsKit.init({
      network: Networks.TESTNET,
      modules: defaultModules(),
    });
    isInitialized = true;
  }
  
  return StellarWalletsKit;
}

/**
 * Mocks a transaction signing operation via the connected wallet type,
 * simulating user signatures, rejections, or balance issues.
 */
export async function simulateWalletSignature(
  address: string,
  walletType: string,
  shouldReject: boolean = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldReject) {
        reject(new Error('UserRejectedSignature: Transaction signature rejected by user.'));
      } else {
        const fakeSig = `Sig_${Math.random().toString(16).substring(2, 10)}_${address.substring(0, 5)}`;
        resolve(fakeSig);
      }
    }, 800);
  });
}
