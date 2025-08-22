import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useAztecWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';
import { useToken } from '../hooks/context/useToken';
import { getEnv } from '../config';

// Constants compatible with Substance Labs bridge
const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_NAME = 'Base Sepolia';

// WETH addresses
const WETH_ON_AZTEC_SEPOLIA = '0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb';
const WETH_ON_BASE_SEPOLIA = '0x1BDD24840e119DC2602dCC587Dd182812427A5Cc';

export const BridgeOutCard: React.FC = () => {
  const { connectedAccount, tokenService } = useAztecWallet();
  const { addError } = useError();
  const { formattedBalances, currentTokenAddress } = useToken();
  const config = getEnv();

  const [evmAddress, setEvmAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [wethBalance, setWethBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const provider = (globalThis as any).ethereum
    ? new ethers.BrowserProvider((globalThis as any).ethereum)
    : null;
  const canInteract = !!provider;

  const aztecAddress = connectedAccount?.getAddress().toString() ?? '';
  const shorten = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—';

  // Get EVM wallet address
  useEffect(() => {
    const load = async () => {
      if (!provider) return;
      try {
        await ((provider as any).provider?.request?.({
          method: 'eth_requestAccounts',
        }) ?? (provider as any).send('eth_requestAccounts', []));
        const signer = await provider.getSigner();
        setEvmAddress(await signer.getAddress());
      } catch (error) {
        console.error('Failed to get EVM address:', error);
      }
    };
    load();
  }, [provider]);

  // Fetch WETH balance
  useEffect(() => {
    const fetchWethBalance = async () => {
      if (!tokenService || !connectedAccount) return;
      try {
        const ownerAddress = connectedAccount.getAddress().toString();

        // Make calls sequential to avoid PXE concurrency issues (like TokenProvider does)
        const privateBalance = await tokenService.getPrivateBalance(
          WETH_ON_AZTEC_SEPOLIA,
          ownerAddress
        );
        const publicBalance = await tokenService.getPublicBalance(
          WETH_ON_AZTEC_SEPOLIA,
          ownerAddress
        );

        setWethBalance(privateBalance + publicBalance);
      } catch (error) {
        console.error('Failed to fetch WETH balance:', error);
        setWethBalance(BigInt(0));
      }
    };

    fetchWethBalance();
  }, [tokenService, connectedAccount]);

  const formatWethBalance = () => {
    if (wethBalance === null) return 'Loading...';
    return ethers.formatUnits(wethBalance, 18);
  };

  const validateInputs = () => {
    if (!amount || parseFloat(amount) <= 0) {
      addError({
        message: 'Please enter a valid amount',
        type: 'error',
        source: 'bridge',
      });
      return false;
    }
    if (!evmAddress || !ethers.isAddress(evmAddress)) {
      addError({
        message: 'Please connect your EVM wallet',
        type: 'error',
        source: 'bridge',
      });
      return false;
    }
    if (
      wethBalance &&
      parseFloat(amount) > parseFloat(ethers.formatUnits(wethBalance, 18))
    ) {
      addError({
        message: 'Insufficient WETH balance',
        type: 'error',
        source: 'bridge',
      });
      return false;
    }
    return true;
  };

  const initiateBridgeOut = async () => {
    if (!validateInputs()) return;

    try {
      setIsLoading(true);

      // For now, just show a placeholder message since we need to integrate with the actual bridge
      addError({
        message: `Bridge-out would transfer ${amount} WETH to ${shorten(evmAddress)} on Base Sepolia`,
        type: 'info',
        source: 'bridge',
      });

      setAmount('');
      // Refresh WETH balance after transaction
      const refreshWethBalance = async () => {
        if (!tokenService || !connectedAccount) return;
        try {
          const ownerAddress = connectedAccount.getAddress().toString();

          const privateBalance = await tokenService.getPrivateBalance(
            WETH_ON_AZTEC_SEPOLIA,
            ownerAddress
          );
          const publicBalance = await tokenService.getPublicBalance(
            WETH_ON_AZTEC_SEPOLIA,
            ownerAddress
          );

          setWethBalance(privateBalance + publicBalance);
        } catch (error) {
          console.error('Failed to refresh WETH balance:', error);
        }
      };
      await refreshWethBalance();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to initiate bridge-out';
      addError({ message: errorMessage, type: 'error', source: 'bridge' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!connectedAccount) return null;

  return (
    <div className="dripper-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">🚀</span>
        </div>
        <div>
          <h3>Bridge Out (Aztec → Base Sepolia)</h3>
          <p>
            Transfer WETH from Aztec to Base Sepolia using privacy-preserving
            bridge.
          </p>
        </div>
      </div>

      {!canInteract && (
        <div className="error-message">
          <p>Connect an EVM wallet (e.g. MetaMask) to use bridging.</p>
        </div>
      )}

      <div className="mint-form-container">
        <div className="form-section">
          <div className="form-group">
            <label>Route</label>
            <div className="route-section">
              <div className="route-chip">
                <span className="route-chain">Aztec</span>
                <span className="route-address">{shorten(aztecAddress)}</span>
              </div>
              <div className="route-arrow">→</div>
              <div className="route-chip">
                <span className="route-chain">{BASE_SEPOLIA_NAME}</span>
                <span className="route-address">{shorten(evmAddress)}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>WETH Balance</label>
            <div className="balance-display">
              <span className="balance-value">{formatWethBalance()} WETH</span>
              <small>Available on Aztec for bridging</small>
            </div>
          </div>

          <div className="form-group">
            <label>Amount</label>
            <input
              className="form-input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={isLoading}
              max={
                wethBalance ? ethers.formatUnits(wethBalance, 18) : undefined
              }
            />
            <small>Available: {formatWethBalance()} WETH</small>
          </div>

          <button
            className="btn btn-primary"
            onClick={initiateBridgeOut}
            disabled={
              !amount ||
              !evmAddress ||
              !ethers.isAddress(evmAddress) ||
              !provider ||
              isLoading
            }
          >
            {isLoading ? 'Processing...' : 'Bridge Out WETH'}
          </button>
        </div>
      </div>
    </div>
  );
};
