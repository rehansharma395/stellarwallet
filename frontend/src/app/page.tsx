'use client';

import React, { useState, useEffect } from 'react';

// Types representing the contract models
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
  // App simulated states matching the Rust contract configurations
  const [adminAddress] = useState<string>('GDCONDUITADMIN2026MARKETINGVAULTXX');
  const [registryContractId, setRegistryContractId] = useState<string>('CCREGISTRYPENDING559128374912');
  const [assetTokenId, setAssetTokenId] = useState<string>('USDC_SAC_WRAPPER_PENDING_001');
  const [campaignName, setCampaignName] = useState<string>('Global Clean Water Initiative');
  const [campaignActive, setCampaignActive] = useState<boolean>(true);
  
  // Vault Pools
  const [vaultBalance, setVaultBalance] = useState<number>(125000);
  const [totalDisbursed, setTotalDisbursed] = useState<number>(45000);
  
  // Interactive whitelisted NGOs list
  const [ngos, setNgos] = useState<WhitelistedNGO[]>([
    { address: 'GCAIDWATERRECIPIENT11234567890XX', name: 'CleanH2O Foundation', category: 'Clean Water', timestamp: '2026-07-11 10:15:30', status: 'Verified' },
    { address: 'GCAIDMEDICSRECIPIENT2234567890YY', name: 'Global Health Alliance', category: 'Medical Aid', timestamp: '2026-07-11 10:20:45', status: 'Verified' },
  ]);

  // Form inputs
  const [newNGOAddress, setNewNGOAddress] = useState<string>('');
  const [newNGOName, setNewNGOName] = useState<string>('');
  const [newNGOCategory, setNewNGOCategory] = useState<string>('Clean Water');
  
  const [disburseNGOAddress, setDisburseNGOAddress] = useState<string>('GCAIDWATERRECIPIENT11234567890XX');
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

  // Helper to add terminal output lines
  const addTerminalLog = (line: string) => {
    setTerminalLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  // Deposit funds into router donor pool
  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;
    
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
    addTerminalLog(`TokenClient::mint to router_contract -> added ${depositAmount} USDC. Balance: ${vaultBalance + depositAmount} USDC.`);
    setDepositAmount(10000);
  };

  // Add NGO to Whitelist Registry
  const handleWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNGOAddress || !newNGOName) {
      addTerminalLog('ERROR: Whitelist failed - target NGO address and name are required.');
      return;
    }

    if (!newNGOAddress.startsWith('G') || newNGOAddress.length < 20) {
      addTerminalLog('ERROR: Whitelist failed - invalid Stellar Address format.');
      return;
    }

    // Check duplicate
    if (ngos.some((n) => n.address.toLowerCase() === newNGOAddress.toLowerCase())) {
      addTerminalLog(`ERROR: Whitelist failed - Address ${newNGOAddress.substring(0, 10)}... already whitelisted.`);
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
    addTerminalLog(`RecipientRegistryContract::whitelist_recipient(admin=GDCONDU..., target=${newNGOAddress.substring(0, 8)}...) executed. Emitted event reg_ngo.`);
    
    // Reset form
    setNewNGOAddress('');
    setNewNGOName('');
  };

  // Remove NGO from Whitelist Registry
  const handleRemoveWhitelist = (address: string, name: string) => {
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
    addTerminalLog(`RecipientRegistryContract::remove_recipient(admin=GDCONDU..., target=${address.substring(0, 8)}...) executed.`);
  };

  // Disburse Aid Flow mimicking Soroban checks
  const handleDisburseAid = (e: React.FormEvent) => {
    e.preventDefault();
    
    addTerminalLog(`[INVOCATION] aid_router.disburse_aid(target_ngo=${disburseNGOAddress.substring(0, 8)}..., amount=${disburseAmount} USDC) started.`);
    
    // 1. Check campaign status
    if (!campaignActive) {
      addTerminalLog('EXECUTION ERROR: CampaignInactive. Disbursement rejected.');
      
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

    // 2. Query registry (Cross-Contract call check)
    const targetNGO = ngos.find((n) => n.address === disburseNGOAddress);
    
    addTerminalLog(`Cross-Contract Call: env.invoke_contract::<bool>(&registry_contract_id, validate_recipient, [${disburseNGOAddress.substring(0, 8)}...]) triggered.`);
    
    if (!targetNGO || targetNGO.status !== 'Verified') {
      addTerminalLog('EXECUTION ERROR: UnverifiedRecipient. Recipient validation check returned FALSE. Disbursement reverted.');
      
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

    addTerminalLog('Cross-Contract Call returned TRUE: Recipient is verified.');

    // 3. Check router vault balance
    if (disburseAmount > vaultBalance) {
      addTerminalLog(`EXECUTION ERROR: InsufficientFunds. Requested: ${disburseAmount} USDC, Available: ${vaultBalance} USDC. Reverted.`);
      
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

    // 4. Update balances
    setVaultBalance((prev) => prev - disburseAmount);
    setTotalDisbursed((prev) => prev + disburseAmount);
    
    // 5. Success and Event Emission
    const txHash = `SorobanTx_0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`;
    
    addTerminalLog(`Subsequent Call: env.invoke_contract(&asset_token_id, transfer, [from: router, to: ${disburseNGOAddress.substring(0, 8)}..., amount: ${disburseAmount}]) succeeded.`);
    addTerminalLog(`Emitted event: disburse(recipient=${disburseNGOAddress.substring(0, 8)}..., amount=${disburseAmount}, timestamp=${Math.floor(Date.now() / 1000)})`);
    addTerminalLog(`Transaction confirmed. Hash: ${txHash}`);

    const newLog: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'DISBURSE',
      status: 'SUCCESS',
      details: `Routed ${disburseAmount.toLocaleString()} USDC to whitelisted NGO: "${targetNGO.name}"`,
      txHash
    };

    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Toggle active campaign configuration
  const handleToggleCampaign = () => {
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
    addTerminalLog(`aid_router.update_campaign_active(active=${nextState}) invoked by admin. Storage updated.`);
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-12 left-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-48 right-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            C
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-50 via-zinc-100 to-indigo-400">
              CONDUIT
            </h1>
            <p className="text-xs text-zinc-500 font-mono">Programmatic Micro-Aid Router</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
            <span className="font-mono text-zinc-400">Active Admin:</span>
            <span className="font-mono text-indigo-400 font-semibold">{adminAddress.substring(0, 12)}...</span>
          </div>

          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-full font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            SOROBAN LOCAL SIMULATION
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="relative max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns - Configuration & Pools */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Metrics Panel */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-zinc-800/60 shadow-xl flex flex-col justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase font-mono">Donor Pool Vault Balance</p>
                <h3 className="text-3xl font-extrabold mt-2 text-zinc-50 font-mono">
                  {vaultBalance.toLocaleString()} <span className="text-sm font-semibold text-zinc-500">USDC</span>
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-indigo-400">Asset SAC ID:</span>
                <span className="font-mono text-zinc-500">{assetTokenId.substring(0, 10)}...</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-zinc-800/60 shadow-xl flex flex-col justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase font-mono">Total Aid Disbursed</p>
                <h3 className="text-3xl font-extrabold mt-2 text-zinc-50 font-mono">
                  {totalDisbursed.toLocaleString()} <span className="text-sm font-semibold text-zinc-500">USDC</span>
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                ✓ 100% Whitelisted NGOs Routed
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-zinc-800/60 shadow-xl flex flex-col justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase font-mono">Active Whitelisted NGOs</p>
                <h3 className="text-3xl font-extrabold mt-2 text-zinc-50 font-mono">
                  {ngos.length} <span className="text-sm font-semibold text-zinc-500">Verified</span>
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-violet-400 font-semibold">Registry ID:</span>
                <span className="font-mono text-zinc-500">{registryContractId.substring(0, 10)}...</span>
              </div>
            </div>

          </section>

          {/* Campaign Configuration & Pool Deposit */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Campaign Config Card */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Router Configuration
                  </h3>
                  <button 
                    onClick={handleToggleCampaign}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
                      campaignActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {campaignActive ? 'Campaign Active' : 'Campaign Paused'}
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-4 text-sm">
                  <div>
                    <label className="text-xs text-zinc-400 font-mono block">Campaign Name</label>
                    <input 
                      type="text" 
                      value={campaignName} 
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200 font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-mono block">Registry Contract Address</label>
                    <input 
                      type="text" 
                      value={registryContractId} 
                      onChange={(e) => setRegistryContractId(e.target.value)}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-mono block">USDC Token SAC Wrapper</label>
                    <input 
                      type="text" 
                      value={assetTokenId} 
                      onChange={(e) => setAssetTokenId(e.target.value)}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-300 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                <span>Auth: GDCONDUITADMIN...</span>
                <span>Config locked on-chain</span>
              </div>
            </div>

            {/* Donor Pool Deposit Form */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center border-b border-zinc-800 pb-3">
                  <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Deposit Donor Capital
                  </h3>
                </div>

                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Mint new tokens on the Stellar Asset Contract (SAC) directly into the Conduit Router contract vault to scale the active donor pool.
                </p>

                <form onSubmit={handleDeposit} className="mt-4 flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 font-mono block">Funding Amount (USDC)</label>
                    <div className="relative mt-1">
                      <input 
                        type="number" 
                        value={depositAmount} 
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200 font-mono text-sm pr-16"
                      />
                      <div className="absolute right-3 top-2.5 text-zinc-500 text-xs font-bold font-mono">USDC</div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
                  >
                    Invoke SAC::mint
                  </button>
                </form>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                <span>Direct vault custody</span>
                <span>SAC contract wrapper</span>
              </div>
            </div>

          </section>

          {/* Whitelisted NGO Database Panel */}
          <section className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 shadow-lg">
            <h3 className="font-bold text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Recipient Registry Whitelisted NGOs
            </h3>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-mono">
                    <th className="py-2">NGO Name</th>
                    <th className="py-2">Stellar Address</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {ngos.map((ngo) => (
                    <tr key={ngo.address} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3 font-semibold text-zinc-100">{ngo.name}</td>
                      <td className="py-3 font-mono text-zinc-400 text-xs">
                        {ngo.address.substring(0, 12)}...{ngo.address.substring(ngo.address.length - 8)}
                      </td>
                      <td className="py-3 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                          {ngo.category}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {ngo.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button 
                          onClick={() => handleRemoveWhitelist(ngo.address, ngo.name)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-medium hover:underline"
                        >
                          Revoke Whitelist
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ngos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500 font-mono text-xs">
                        No NGOs whitelisted in the recipient_registry contract.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>

        {/* Right Column - Actions & Execution Logs */}
        <div className="flex flex-col gap-8">
          
          {/* Whitelist Recipient Registry Action */}
          <section className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 shadow-lg">
            <h3 className="font-bold text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Whitelist Recipient Authority
            </h3>

            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Require Admin signatures to register new NGO public keys. Adds NGOs to registry database and emits <code className="font-mono text-indigo-400 bg-indigo-950/20 px-1 py-0.5 rounded text-[11px]">reg_ngo</code> event.
            </p>

            <form onSubmit={handleWhitelist} className="mt-4 flex flex-col gap-4 text-sm">
              <div>
                <label className="text-xs text-zinc-400 font-mono block">NGO Public Key (Stellar Address)</label>
                <input 
                  type="text" 
                  value={newNGOAddress} 
                  onChange={(e) => setNewNGOAddress(e.target.value)}
                  placeholder="G..."
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-300 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono block">NGO/Charity Name</label>
                <input 
                  type="text" 
                  value={newNGOName} 
                  onChange={(e) => setNewNGOName(e.target.value)}
                  placeholder="e.g. Save The Oceans"
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono block">Category</label>
                <select 
                  value={newNGOCategory} 
                  onChange={(e) => setNewNGOCategory(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200"
                >
                  <option value="Clean Water">Clean Water & Sanitation</option>
                  <option value="Medical Aid">Emergency Medical Care</option>
                  <option value="Education">Education & Development</option>
                  <option value="Environment">Environmental Preservation</option>
                </select>
              </div>

              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-semibold transition-all duration-200"
              >
                Whitelist Recipient (Admin Auth)
              </button>
            </form>
          </section>

          {/* Trigger Disbursement Action */}
          <section className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 shadow-lg">
            <h3 className="font-bold text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Trigger Aid Disbursement
            </h3>

            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Triggers programmatic cross-contract checks to verify if the recipient is whitelisted in registry. If true, routes SAC token balance.
            </p>

            <form onSubmit={handleDisburseAid} className="mt-4 flex flex-col gap-4 text-sm">
              <div>
                <label className="text-xs text-zinc-400 font-mono block">Select Recipient NGO</label>
                <select 
                  value={disburseNGOAddress} 
                  onChange={(e) => setDisburseNGOAddress(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200"
                >
                  {ngos.map((ngo) => (
                    <option key={ngo.address} value={ngo.address}>
                      {ngo.name} ({ngo.address.substring(0, 6)}...)
                    </option>
                  ))}
                  <option value="GCAIDUNKNOWNCHARITYADDRESS999999XX">Unverified Charity (Mock Test Fail)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-mono block">Disbursement Amount (USDC)</label>
                <div className="relative mt-1">
                  <input 
                    type="number" 
                    value={disburseAmount} 
                    onChange={(e) => setDisburseAmount(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 text-zinc-200 font-mono text-sm pr-16"
                  />
                  <div className="absolute right-3 top-2.5 text-zinc-500 text-xs font-bold font-mono">USDC</div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
              >
                Invoke disburse_aid
              </button>
            </form>
          </section>

          {/* Soroban Live Terminal Logs */}
          <section className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-zinc-300 flex items-center gap-2 text-sm font-mono">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  Soroban VM Console
                </h3>
                <button 
                  onClick={() => setTerminalLogs([])}
                  className="text-zinc-500 hover:text-zinc-400 font-mono text-[10px] uppercase border border-zinc-800 px-2 py-0.5 rounded"
                >
                  Clear
                </button>
              </div>

              <div className="mt-4 font-mono text-[11px] text-indigo-300 leading-relaxed max-h-[220px] overflow-y-auto flex flex-col gap-1.5">
                {terminalLogs.map((log, index) => (
                  <div key={index} className="border-l border-zinc-800 pl-2">
                    {log}
                  </div>
                ))}
                {terminalLogs.length === 0 && (
                  <div className="text-zinc-600 text-center py-8">Console output is empty.</div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 flex justify-between font-mono">
              <span>Network: Localhost-Sandbox</span>
              <span>Ledger: #451298</span>
            </div>
          </section>

        </div>

      </main>

      {/* Transaction & Audit Ledger */}
      <section className="max-w-7xl mx-auto px-6 mt-8">
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 shadow-lg">
          <h3 className="font-bold text-zinc-100 border-b border-zinc-800 pb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Audit Ledger & Event Log
          </h3>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-zinc-300">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-mono">
                  <th className="py-2">Timestamp</th>
                  <th className="py-2">Action Type</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Transaction Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="py-3 text-xs text-zinc-400 font-mono">{log.timestamp}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        log.type === 'WHITELIST' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        log.type === 'DISBURSE' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                        log.type === 'DEPOSIT' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        log.type === 'REMOVE_WHITELIST' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-zinc-300">{log.details}</td>
                    <td className="py-3 text-right font-mono text-zinc-500 text-xs">{log.txHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}
