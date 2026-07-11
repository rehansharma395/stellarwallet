'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { formatStellarAddress, isValidStellarAddress } from '../utils/math';
import { getStellarWalletsKit } from '../utils/wallet';
import {
  initialUIState,
  handleLoadComplete,
  handleFailedTransaction,
  handleSuccessfulTransaction,
  handleClearToast,
  UIState,
} from '../utils/uiController';

interface WhitelistedNGO {
  address: string;
  name: string;
  category: string;
  timestamp: string;
  status: 'Verified' | 'Suspended';
}

interface AuditLog {
  id: string;
  timestamp: string;
  type: 'WHITELIST' | 'DISBURSE' | 'DEPOSIT' | 'CONFIG_UPDATE' | 'REMOVE_WHITELIST';
  status: 'SUCCESS' | 'FAILED';
  details: string;
  txHash: string;
}

export default function Home() {
  // App UI State
  const [ui, setUi] = useState<UIState>(initialUIState);

  // Stellar Wallet Connect States
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [simulateUserReject, setSimulateUserReject] = useState<boolean>(false);
  const [simulateRPCTimeout, setSimulateRPCTimeout] = useState<boolean>(false);

  // App simulated states matching the Rust contract configurations
  const [adminAddress] = useState<string>('GDCONDUITADMINXXYTWENTYTWOSIXMARKETINGVAULTXX55566677722');
  const [registryContractId, setRegistryContractId] = useState<string>('CCDMRCGEXGRMM2JYED27C7S62UKISLXXTMRNKXRBFNVSANB7QGX4ZVDV');
  const [assetTokenId, setAssetTokenId] = useState<string>('CAJ2ELOFEDQSGTASFIZH7JTQIVHYN44RLPV6AUARHFVIB4UHH3TSATLA');
  const [campaignName, setCampaignName] = useState<string>('Global Clean Water Initiative');
  const [campaignActive, setCampaignActive] = useState<boolean>(true);
  
  // Vault Pools & Counter Centerpiece
  const [vaultBalance, setVaultBalance] = useState<number>(125000);
  const [totalDisbursed, setTotalDisbursed] = useState<number>(45000);
  const [stroopsRouted, setStroopsRouted] = useState<number>(450000000000); // Live metric centerpiece
  
  // Interactive whitelisted NGOs list
  const [ngos, setNgos] = useState<WhitelistedNGO[]>([
    { address: 'GDWATERRECIPIENT11234567890XX55566677788899900011122', name: 'CleanH2O Foundation', category: 'Clean Water', timestamp: '2026-07-11 10:15:30', status: 'Verified' },
    { address: 'GDMEDICSRECIPIENT2234567890YY55566677788899900011122', name: 'Global Health Alliance', category: 'Medical Aid', timestamp: '2026-07-11 10:20:45', status: 'Verified' },
  ]);

  // Form inputs
  const [newNGOAddress, setNewNGOAddress] = useState<string>('');
  const [newNGOName, setNewNGOName] = useState<string>('');
  const [newNGOCategory, setNewNGOCategory] = useState<string>('Clean Water');
  
  const [disburseNGOAddress, setDisburseNGOAddress] = useState<string>('GDWATERRECIPIENT11234567890XX55566677788899900011122');
  const [disburseAmount, setDisburseAmount] = useState<number>(5000);
  const [depositAmount, setDepositAmount] = useState<number>(25000);

  // Simulated output log terminal
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Conduit Node [v1.0.0] initialized successfully.',
    'Connecting to local Soroban host client on network testnet...',
    'Synced with contract: recipient_registry (validated: true)',
    'Synced with contract: aid_router (validated: true)',
  ]);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    { id: '1', timestamp: '2026-07-11 10:15:30', type: 'WHITELIST', status: 'SUCCESS', details: 'Charity "CleanH2O Foundation" whitelisted by Admin.', txHash: 'SorobanTx_0x1b4a...c9d0' },
    { id: '2', timestamp: '2026-07-11 10:20:45', type: 'WHITELIST', status: 'SUCCESS', details: 'Charity "Global Health Alliance" whitelisted by Admin.', txHash: 'SorobanTx_0x3e2f...b8a1' },
    { id: '3', timestamp: '2026-07-11 10:30:10', type: 'DEPOSIT', status: 'SUCCESS', details: 'Deposited 25,000 USDC into Aid Router donor pool.', txHash: 'SorobanTx_0x9a8b...f7e6' },
  ]);

  // Custom SWR event fetcher targeting testnet RPC endpoint
  const rpcEventsFetcher = async (url: string) => {
    // If user triggers simulated RPC timeout, fail intentionally to show failsafe retries
    if (simulateRPCTimeout) {
      throw new Error('RPCTimeout: Testnet RPC request timed out. Retrying automatically...');
    }
    
    // Perform standard RPC POST request structure
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getEvents',
        params: {
          startLedger: 4500000,
          filters: [
            {
              type: 'contract',
              contractIds: [registryContractId],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error('RPCError: Failed to fetch on-chain events from Stellar Testnet.');
    }
    return response.json();
  };

  // SWR Event Polling Loop (polls every 6 seconds)
  const { data: rpcData, error: rpcError } = useSWR(
    'https://soroban-testnet.stellar.org',
    rpcEventsFetcher,
    {
      refreshInterval: 6000,
      dedupingInterval: 6000,
      errorRetryCount: 99,
      errorRetryInterval: 2500,
    }
  );

  // Trigger SWR error notifications / auto retry states
  useEffect(() => {
    if (rpcError) {
      setUi((prev) => handleFailedTransaction(prev, rpcError.message || 'RPC Connection Timeout.'));
      addTerminalLog(`[RPC WARNING] Connection timed out. Auto-retry mechanism engaged...`);
    }
  }, [rpcError]);

  // Simulate initial loading skeleton polling
  useEffect(() => {
    const timer = setTimeout(() => {
      setUi(handleLoadComplete);
      addTerminalLog('On-chain metrics loaded successfully from ledger.');
    }, 850);
    return () => clearTimeout(timer);
  }, []);

  // Auto clear toast notification after 5s
  useEffect(() => {
    if (ui.toast) {
      const timer = setTimeout(() => {
        setUi(handleClearToast);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [ui.toast]);

  const addTerminalLog = (line: string) => {
    setTerminalLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  // Connect wallet method via StellarWalletsKit
  const handleConnectWallet = async () => {
    try {
      const kit = await getStellarWalletsKit();
      if (!kit) return;

      setUi((prev) => handleClearToast(prev));
      const res = await kit.authModal();
      const address = res.address;
      
      // Successfully connect and set address
      setWalletAddress(address);
      setWalletType('Stellar Extension');
      setUi((prev) => handleSuccessfulTransaction(prev, `Connected to wallet successfully!`));
      addTerminalLog(`WalletConnected: Connected via kit. Address: ${address.substring(0, 10)}...`);
    } catch (err: any) {
      // Failsafe state 1: Wallet software missing/disconnected trigger simulation
      if (err.message && (err.message.includes('missing') || err.message.includes('not found'))) {
        setUi((prev) => handleFailedTransaction(prev, 'WalletMissing: Stellar wallet extension software is missing or disconnected.'));
      } else {
        setUi((prev) => handleFailedTransaction(prev, 'UserCancelled: Wallet connection request was cancelled by user.'));
      }
    }
  };

  // Disconnect wallet
  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    setWalletType(null);
    setUi((prev) => handleSuccessfulTransaction(prev, 'Wallet disconnected successfully.'));
    addTerminalLog('WalletDisconnected: User closed the active wallet session.');
  };

  // Deposit funds into router donor pool
  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;

    // Failsafe check: Wallet connection required to mint/deposit
    if (!walletAddress) {
      setUi((prev) => handleFailedTransaction(prev, 'WalletDisconnected: You must connect your Stellar wallet before executing transactions.'));
      return;
    }
    
    setVaultBalance((prev) => prev + depositAmount);
    
    const newLog: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'DEPOSIT',
      status: 'SUCCESS',
      details: `Deposited ${depositAmount.toLocaleString()} USDC into donor pool.`,
      txHash: `SorobanTx_0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
    };
    
    setAuditLogs((prev) => [newLog, ...prev]);
    setUi((prev) => handleSuccessfulTransaction(prev, `Deposited ${depositAmount.toLocaleString()} USDC into donor pool.`));
    addTerminalLog(`TokenClient::mint to router_contract -> added ${depositAmount} USDC. Balance: ${vaultBalance + depositAmount} USDC.`);
    setDepositAmount(10000);
  };

  // Add NGO to Whitelist Registry
  const handleWhitelist = (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletAddress) {
      setUi((prev) => handleFailedTransaction(prev, 'WalletDisconnected: Whitelisting actions require an active admin wallet session.'));
      return;
    }

    if (!newNGOAddress || !newNGOName) {
      setUi((prev) => handleFailedTransaction(prev, 'Whitelist failed - NGO address and name are required.'));
      return;
    }

    if (!isValidStellarAddress(newNGOAddress)) {
      setUi((prev) => handleFailedTransaction(prev, 'Invalid Stellar address format. Must be G... and exactly 56 characters using A-Z/2-7 characters.'));
      return;
    }

    // Check duplicate
    if (ngos.some((n) => n.address.toLowerCase() === newNGOAddress.toLowerCase())) {
      setUi((prev) => handleFailedTransaction(prev, 'NGO address is already registered in the whitelist registry.'));
      return;
    }

    const newNGO: WhitelistedNGO = {
      address: newNGOAddress,
      name: newNGOName,
      category: newNGOCategory,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'Verified',
    };

    setNgos((prev) => [...prev, newNGO]);

    const newLog: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'WHITELIST',
      status: 'SUCCESS',
      details: `NGO "${newNGOName}" Whitelisted (Topic: reg_ngo).`,
      txHash: `SorobanTx_0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    setUi((prev) => handleSuccessfulTransaction(prev, `Successfully whitelisted "${newNGOName}" in Recipient Registry.`));
    addTerminalLog(`RecipientRegistryContract::whitelist_recipient(admin=GDCONDU..., target=${newNGOAddress.substring(0, 8)}...) executed. Emitted event reg_ngo.`);
    
    // Reset form
    setNewNGOAddress('');
    setNewNGOName('');
  };

  // Remove NGO from Whitelist Registry
  const handleRemoveWhitelist = (address: string, name: string) => {
    if (!walletAddress) {
      setUi((prev) => handleFailedTransaction(prev, 'WalletDisconnected: Admin wallet connection is required to modify whitelisted registries.'));
      return;
    }

    setNgos((prev) => prev.filter((ngo) => ngo.address !== address));
    
    const newLog: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'REMOVE_WHITELIST',
      status: 'SUCCESS',
      details: `NGO "${name}" removed from whitelist.`,
      txHash: `SorobanTx_0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    setUi((prev) => handleSuccessfulTransaction(prev, `Removed "${name}" from Recipient Registry.`));
    addTerminalLog(`RecipientRegistryContract::remove_recipient(admin=GDCONDU..., target=${address.substring(0, 8)}...) executed.`);
  };

  // Disburse Aid Flow mimicking Soroban checks
  const handleDisburseAid = (e: React.FormEvent) => {
    e.preventDefault();
    
    addTerminalLog(`[INVOCATION] aid_router.disburse_aid(target_ngo=${disburseNGOAddress.substring(0, 8)}..., amount=${disburseAmount} USDC) started.`);
    
    // Failsafe check 1: Wallet connected check
    if (!walletAddress) {
      setUi((prev) => handleFailedTransaction(prev, 'WalletDisconnected: Connect your wallet prior to signing the disbursement transaction.'));
      return;
    }

    // Failsafe check 2: User rejected signature trigger
    if (simulateUserReject) {
      const err = 'UserRejectedSignature: Transaction signature was explicitly rejected in the Freighter browser extension.';
      addTerminalLog(`[SIGNATURE REJECTED] User cancelled Freighter auth request.`);
      setUi((prev) => handleFailedTransaction(prev, err));
      return;
    }

    // Failsafe check 3: Insufficient asset balance check
    if (disburseAmount > vaultBalance) {
      const err = `InsufficientBalance: Connected wallet balance (${vaultBalance} USDC) is less than requested amount (${disburseAmount} USDC).`;
      addTerminalLog(`EXECUTION ERROR: ${err} Reverted.`);
      setUi((prev) => handleFailedTransaction(prev, err));
      
      setAuditLogs((prev) => [{
        id: Date.now().toString(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        type: 'DISBURSE',
        status: 'FAILED',
        details: `Disbursement of ${disburseAmount} USDC failed: Insufficient Funds.`,
        txHash: 'None'
      }, ...prev]);
      return;
    }

    // Failsafe check 4: Contract error configs (e.g. Campaign Inactive or Unverified)
    if (!campaignActive) {
      const err = 'ContractError::CampaignInactive: Campaign configuration is currently paused by admin.';
      addTerminalLog(`EXECUTION ERROR: ${err} Disbursement rejected.`);
      setUi((prev) => handleFailedTransaction(prev, err));
      
      setAuditLogs((prev) => [{
        id: Date.now().toString(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        type: 'DISBURSE',
        status: 'FAILED',
        details: `Disbursement of ${disburseAmount} USDC failed: Campaign Inactive.`,
        txHash: 'None'
      }, ...prev]);
      return;
    }

    const targetNGO = ngos.find((n) => n.address === disburseNGOAddress);
    
    if (!targetNGO || targetNGO.status !== 'Verified') {
      const err = 'ContractError::UnverifiedRecipient: Recipient is not registered or verified in the Recipient Registry contract.';
      addTerminalLog(`EXECUTION ERROR: ${err} Reverted.`);
      setUi((prev) => handleFailedTransaction(prev, err));
      
      setAuditLogs((prev) => [{
        id: Date.now().toString(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        type: 'DISBURSE',
        status: 'FAILED',
        details: `Disbursement of ${disburseAmount} USDC failed: Unverified Recipient.`,
        txHash: 'None'
      }, ...prev]);
      return;
    }

    // 4. Update balances & counter centerpiece
    setVaultBalance((prev) => prev - disburseAmount);
    setTotalDisbursed((prev) => prev + disburseAmount);
    // 1 USDC = 10,000,000 Stroops. Add disbursement amount to global counter.
    setStroopsRouted((prev) => prev + (disburseAmount * 10_000_000));
    
    // 5. Success and Event Emission
    const txHash = `SorobanTx_0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`;
    
    addTerminalLog(`Subsequent Call: env.invoke_contract(&asset_token_id, transfer, [from: router, to: ${disburseNGOAddress.substring(0, 8)}..., amount: ${disburseAmount}]) succeeded.`);
    addTerminalLog(`Emitted event: disburse(recipient=${disburseNGOAddress.substring(0, 8)}..., amount=${disburseAmount}, timestamp=${Math.floor(Date.now() / 1000)})`);
    addTerminalLog(`Transaction confirmed. Hash: ${txHash}`);

    const msg = `Routed ${disburseAmount.toLocaleString()} USDC (${(disburseAmount * 10_000_000).toLocaleString()} Stroops) to whitelisted NGO: "${targetNGO.name}"`;
    setUi((prev) => handleSuccessfulTransaction(prev, msg));

    const newLog: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'DISBURSE',
      status: 'SUCCESS',
      details: msg,
      txHash
    };

    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Toggle active campaign configuration
  const handleToggleCampaign = () => {
    if (!walletAddress) {
      setUi((prev) => handleFailedTransaction(prev, 'WalletDisconnected: Admin wallet connection is required to modify campaign states.'));
      return;
    }

    const nextState = !campaignActive;
    setCampaignActive(nextState);
    
    const newLog: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'CONFIG_UPDATE',
      status: 'SUCCESS',
      details: `Campaign active state set to: ${nextState ? 'ACTIVE' : 'INACTIVE'} (Admin Authorization Verified).`,
      txHash: `SorobanTx_0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    setUi((prev) => handleSuccessfulTransaction(prev, `Campaign status set to ${nextState ? 'ACTIVE' : 'PAUSED'}.`));
    addTerminalLog(`aid_router.update_campaign_active(active=${nextState}) invoked by admin. Storage updated.`);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-600 selection:text-white pb-16 relative">
      
      {/* Top Border Line Accent */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

      {/* Reactive Toast Notification Box */}
      {ui.toast && (
        <div 
          id="toast-notification"
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3.5 rounded-lg border shadow-2xl transition-all duration-300 ${
            ui.toast.type === 'success'
              ? 'bg-zinc-900 border-emerald-500/50 text-emerald-400'
              : 'bg-zinc-900 border-rose-500/50 text-rose-400'
          }`}
        >
          <div className="flex flex-col gap-0.5 max-w-sm">
            <span className="text-xs font-bold uppercase font-mono tracking-wider opacity-75">
              {ui.toast.type === 'success' ? '✓ Operation Confirmed' : '⚠ Exception Triggered'}
            </span>
            <span className="text-xs leading-relaxed">{ui.toast.message}</span>
          </div>
          <button 
            onClick={() => setUi(handleClearToast)}
            className="text-xs opacity-75 hover:opacity-100 bg-zinc-800 hover:bg-zinc-700 h-5 w-5 rounded flex items-center justify-center font-bold font-mono"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-indigo-600 flex items-center justify-center font-black text-sm text-white tracking-widest">
            C
          </div>
          <div>
            <h1 className="text-md font-extrabold tracking-widest text-zinc-50">
              CONDUIT
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono">Programmatic Micro-Aid Router</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {walletAddress ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[10px] text-zinc-500 font-mono uppercase">Wallet Connected ({walletType})</span>
                <span className="text-xs font-mono text-indigo-400 font-medium">{formatStellarAddress(walletAddress)}</span>
              </div>
              <button 
                onClick={handleDisconnectWallet}
                className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs px-4 py-2 rounded font-semibold transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={handleConnectWallet}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded font-semibold transition-colors flex items-center gap-1.5 font-mono"
            >
              Connect Stellar Wallet
            </button>
          )}
        </div>
      </header>

      {/* Loading Skeleton Logic */}
      {ui.isLoading ? (
        <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8 animate-pulse" id="loading-skeleton">
          {/* Skeleton Header centerpiece */}
          <div className="h-32 rounded-lg bg-zinc-900/60 border border-zinc-800/80" />
          {/* Skeleton Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="h-64 rounded-lg bg-zinc-900/60 border border-zinc-800/80" />
              <div className="h-96 rounded-lg bg-zinc-900/60 border border-zinc-800/80" />
            </div>
            <div className="h-[550px] rounded-lg bg-zinc-900/60 border border-zinc-800/80" />
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
          
          {/* Live Global Ledger Counter centerpiece */}
          <section className="p-8 rounded-lg bg-zinc-900/30 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
            <div>
              <p className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase font-mono">Real-Time Ledger Counter</p>
              <h2 className="text-4xl sm:text-5xl font-black text-zinc-50 font-mono tracking-tight mt-1 animate-pulse">
                {stroopsRouted.toLocaleString()} <span className="text-lg font-bold text-zinc-500">Stroops</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Stroops Routed Globally to verified field recipients via Stellar Soroban contracts.</p>
            </div>
            <div className="flex gap-4 sm:border-l border-zinc-800 sm:pl-8 py-2 w-full sm:w-auto shrink-0 justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 font-mono uppercase block">Active Campaign</span>
                <span className="text-sm font-bold text-zinc-200">{campaignName}</span>
              </div>
              <div className="text-right sm:text-left">
                <span className="text-[10px] text-zinc-500 font-mono uppercase block">Total Disbursed</span>
                <span className="text-sm font-bold font-mono text-zinc-200">{totalDisbursed.toLocaleString()} USDC</span>
              </div>
            </div>
          </section>

          {/* Controls and Terminal logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Content Column */}
            <div className="lg:col-span-2 flex flex-col gap-8">
              
              {/* Custom Alert Boundary Component */}
              {ui.alertMessage && (
                <div 
                  id="alert-boundary"
                  className="p-4 rounded bg-rose-950/20 border border-rose-500/30 text-rose-300 flex items-start gap-3 shadow-md"
                >
                  <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="font-bold text-xs uppercase font-mono tracking-wide">On-chain VM Exception Triggered</h4>
                    <p className="text-xs opacity-90 mt-1">{ui.alertMessage}</p>
                  </div>
                </div>
              )}

              {/* Failsafe Mock Toggles */}
              <div className="p-4 rounded bg-zinc-900/30 border border-zinc-800 flex flex-wrap gap-6 items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-zinc-500 uppercase">Interactive Sandbox Controls:</span>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={simulateUserReject} 
                      onChange={(e) => setSimulateUserReject(e.target.checked)}
                      className="rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-0"
                    />
                    <span>Mock Freighter Reject Signature</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={simulateRPCTimeout} 
                      onChange={(e) => setSimulateRPCTimeout(e.target.checked)}
                      className="rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-0"
                    />
                    <span>Mock Network RPC Timeout</span>
                  </label>
                </div>
              </div>

              {/* Operations Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Router Config */}
                <div className="p-6 rounded bg-zinc-900/20 border border-zinc-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2 uppercase tracking-wider font-mono">
                        Vault Configuration
                      </h3>
                      <button 
                        onClick={handleToggleCampaign}
                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                          campaignActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {campaignActive ? 'Active' : 'Paused'}
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col gap-4 text-xs">
                      <div>
                        <label className="text-[10px] text-zinc-500 font-mono block uppercase">Campaign Name</label>
                        <input 
                          type="text" 
                          value={campaignName} 
                          readOnly
                          className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none text-zinc-400 font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 font-mono block uppercase">Registry Contract ID</label>
                        <input 
                          type="text" 
                          value={registryContractId} 
                          readOnly
                          className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none text-zinc-500 font-mono text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 font-mono block uppercase">USDC Wrapper SAC ID</label>
                        <input 
                          type="text" 
                          value={assetTokenId} 
                          readOnly
                          className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none text-zinc-500 font-mono text-[10px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Admin Address:</span>
                    <span>{formatStellarAddress(adminAddress)}</span>
                  </div>
                </div>

                {/* Pool Funding */}
                <div className="p-6 rounded bg-zinc-900/20 border border-zinc-800 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2 uppercase tracking-wider font-mono">
                      Funding Pool Deposit
                    </h3>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      Mint tokens on the Stellar Asset Contract (SAC) directly into the router contract vault to deposit donor capital.
                    </p>

                    <form onSubmit={handleDeposit} className="mt-4 flex flex-col gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-500 font-mono block uppercase">Funding Amount</label>
                        <div className="relative mt-1">
                          <input 
                            type="number" 
                            value={depositAmount} 
                            onChange={(e) => setDepositAmount(Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200 font-mono text-xs pr-16"
                          />
                          <div className="absolute right-3 top-2.5 text-zinc-500 text-[10px] font-bold font-mono">USDC</div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded py-2 text-xs font-bold transition-colors font-mono uppercase tracking-wide"
                      >
                        Invoke SAC::mint
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Custodied Vault:</span>
                    <span>{vaultBalance.toLocaleString()} USDC</span>
                  </div>
                </div>

              </div>

              {/* NGO Whitelist Table */}
              <section className="p-6 rounded bg-zinc-900/20 border border-zinc-800">
                <h3 className="font-bold text-sm text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2 uppercase tracking-wider font-mono">
                  Registry Whitelisted Recipients
                </h3>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs text-zinc-300">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 font-mono uppercase text-[9px]">
                        <th className="py-2">NGO Name</th>
                        <th className="py-2">Stellar Address</th>
                        <th className="py-2">Category</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {ngos.map((ngo) => (
                        <tr key={ngo.address} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="py-3 font-semibold text-zinc-200">{ngo.name}</td>
                          <td className="py-3 font-mono text-zinc-400">
                            {formatStellarAddress(ngo.address)}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                              {ngo.category}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-mono">
                              <span className="h-1 w-1 rounded-full bg-emerald-400" />
                              {ngo.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button 
                              onClick={() => handleRemoveWhitelist(ngo.address, ngo.name)}
                              className="text-rose-400 hover:text-rose-300 font-mono hover:underline"
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                      {ngos.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-zinc-600 font-mono">
                            No whitelisted NGO recipients in contract registry.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>

            {/* Right Column - Actions & Terminal Logs */}
            <div className="flex flex-col gap-8">
              
              {/* Whitelist Form */}
              <section className="p-6 rounded bg-zinc-900/20 border border-zinc-800">
                <h3 className="font-bold text-sm text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2 uppercase tracking-wider font-mono">
                  Register Recipient
                </h3>

                <form onSubmit={handleWhitelist} className="mt-4 flex flex-col gap-4 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono block uppercase">Stellar Address (56 chars)</label>
                    <input 
                      type="text" 
                      value={newNGOAddress} 
                      onChange={(e) => setNewNGOAddress(e.target.value)}
                      placeholder="G..."
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-300 font-mono text-[10px]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono block uppercase">Charity Name</label>
                    <input 
                      type="text" 
                      value={newNGOName} 
                      onChange={(e) => setNewNGOName(e.target.value)}
                      placeholder="e.g. Save The Oceans"
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono block uppercase">Category</label>
                    <select 
                      value={newNGOCategory} 
                      onChange={(e) => setNewNGOCategory(e.target.value)}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200"
                    >
                      <option value="Clean Water">Clean Water & Sanitation</option>
                      <option value="Medical Aid">Emergency Medical Care</option>
                      <option value="Education">Education & Development</option>
                      <option value="Environment">Environmental Preservation</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded py-2 text-xs font-bold transition-colors font-mono uppercase tracking-wide"
                  >
                    Whitelist NGO
                  </button>
                </form>
              </section>

              {/* Disbursement Trigger */}
              <section className="p-6 rounded bg-zinc-900/20 border border-zinc-800">
                <h3 className="font-bold text-sm text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2 uppercase tracking-wider font-mono">
                  Trigger Disburse
                </h3>

                <form onSubmit={handleDisburseAid} className="mt-4 flex flex-col gap-4 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono block uppercase">NGO Recipient</label>
                    <select 
                      value={disburseNGOAddress} 
                      onChange={(e) => setDisburseNGOAddress(e.target.value)}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200"
                    >
                      {ngos.map((ngo) => (
                        <option key={ngo.address} value={ngo.address}>
                          {ngo.name} ({formatStellarAddress(ngo.address)})
                        </option>
                      ))}
                      <option value="GCAIDUNKNOWNCHARITYADDRESS999999XX">Unverified Charity Address (Test Failure)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono block uppercase">Disbursement Amount</label>
                    <div className="relative mt-1">
                      <input 
                        type="number" 
                        value={disburseAmount} 
                        onChange={(e) => setDisburseAmount(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200 font-mono text-xs pr-16"
                      />
                      <div className="absolute right-3 top-2.5 text-zinc-500 text-[10px] font-bold font-mono">USDC</div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded py-2 text-xs font-bold transition-colors shadow shadow-indigo-600/10 flex items-center justify-center gap-2 font-mono uppercase tracking-wide"
                  >
                    disburse_aid (Sign)
                  </button>
                </form>
              </section>

              {/* Soroban Sandbox Console */}
              <section className="p-6 rounded bg-zinc-950 border border-zinc-850 flex flex-col justify-between flex-1">
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="font-bold text-zinc-400 flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      Soroban VM Console
                    </h3>
                    <button 
                      onClick={() => setTerminalLogs([])}
                      className="text-zinc-500 hover:text-zinc-400 font-mono text-[9px] uppercase border border-zinc-800 px-2 py-0.5 rounded"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-4 font-mono text-[10px] text-zinc-400 leading-relaxed max-h-[180px] overflow-y-auto flex flex-col gap-1.5">
                    {terminalLogs.map((log, index) => (
                      <div key={index} className="border-l border-zinc-800 pl-2">
                        {log}
                      </div>
                    ))}
                    {terminalLogs.length === 0 && (
                      <div className="text-zinc-700 text-center py-6">Console buffer empty.</div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-zinc-800 text-[9px] text-zinc-500 flex justify-between font-mono">
                  <span>Network: Testnet</span>
                  <span>Auto-Polling Active</span>
                </div>
              </section>

            </div>

          </div>

          {/* Audit Ledger List */}
          <section className="p-6 rounded bg-zinc-900/20 border border-zinc-800">
            <h3 className="font-bold text-sm text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2 uppercase tracking-wider font-mono">
              Audit Ledger & Event Logs
            </h3>

            <div className="mt-4 overflow-x-auto font-sans">
              <table className="w-full border-collapse text-left text-xs text-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-mono uppercase text-[9px]">
                    <th className="py-2">Timestamp</th>
                    <th className="py-2">Action Type</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Transaction Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 text-zinc-500 font-mono">{log.timestamp}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono border ${
                          log.type === 'WHITELIST' ? 'bg-zinc-950 text-indigo-400 border-indigo-500/20' :
                          log.type === 'DISBURSE' ? 'bg-zinc-950 text-violet-400 border-violet-500/20' :
                          log.type === 'DEPOSIT' ? 'bg-zinc-950 text-amber-400 border-amber-500/20' :
                          log.type === 'REMOVE_WHITELIST' ? 'bg-zinc-950 text-rose-400 border-rose-500/20' :
                          'bg-zinc-950 text-zinc-400 border-zinc-800'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-300">{log.details}</td>
                      <td className="py-3 text-right font-mono text-zinc-500">{log.txHash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </main>
      )}

    </div>
  );
}
