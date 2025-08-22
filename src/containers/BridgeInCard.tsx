import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useAztecWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';

// Constants from the bridge SDK repo
// Base Sepolia L2Gateway7683 address
const L2_GATEWAY_7683_ADDRESS = '0x0Bf4eD5a115e6Ad789A88c21e9B75821Cc7B2e6f';
// WETH on Base Sepolia used in tests/examples
const WETH_ON_BASE_SEPOLIA = '0x1BDD24840e119DC2602dCC587Dd182812427A5Cc';
// WETH on Aztec Sepolia used in tests/examples
const WETH_ON_AZTEC_SEPOLIA =
  '0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb';

// Minimal ABI for the L2Gateway7683.open(tuple) used for EVM->Aztec
const l2Gateway7683Abi = [
  {
    type: 'function',
    name: 'open',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_order',
        type: 'tuple',
        components: [
          { name: 'fillDeadline', type: 'uint32' },
          { name: 'orderDataType', type: 'bytes32' },
          { name: 'orderData', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'open_private',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_order',
        type: 'tuple',
        components: [
          { name: 'fillDeadline', type: 'uint32' },
          { name: 'orderDataType', type: 'bytes32' },
          { name: 'orderData', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'open_public',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_order',
        type: 'tuple',
        components: [
          { name: 'fillDeadline', type: 'uint32' },
          { name: 'orderDataType', type: 'bytes32' },
          { name: 'orderData', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
];

// ORDER_DATA_TYPE copied from SDK constants
const ORDER_DATA_TYPE =
  '0xf00c3bf60c73eb97097f1c9835537da014e0b755fe94b25d7ac8401df66716a0' as const;
const BASE_SEPOLIA_CHAIN_ID = 84532;

function pad32(hex: `0x${string}`) {
  return hex.length === 66
    ? hex
    : (('0x' + hex.slice(2).padStart(64, '0')) as `0x${string}`);
}

function padHex32(addr: `0x${string}`) {
  return pad32(addr.toLowerCase() as `0x${string}`);
}

export const BridgeInCard: React.FC = () => {
  const { connectedAccount } = useAztecWallet();
  const { addError } = useError();

  const [evmAddress, setEvmAddress] = useState<string>('');
  const [tokenAddress, setTokenAddress] =
    useState<string>(WETH_ON_BASE_SEPOLIA);
  const [amount, setAmount] = useState<string>('');
  const [decimals, setDecimals] = useState<number>(18);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const provider = (globalThis as any).ethereum
    ? new ethers.BrowserProvider((globalThis as any).ethereum)
    : null;
  const canInteract = !!provider;

  const aztecAddress = connectedAccount?.getAddress().toString() ?? '';
  const shorten = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—';

  useEffect(() => {
    const load = async () => {
      if (!provider) return;
      try {
        // request accounts if needed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ((provider as any).provider?.request?.({
          method: 'eth_requestAccounts',
        }) ?? (provider as any).send('eth_requestAccounts', []));
        const signer = await provider.getSigner();
        setEvmAddress(await signer.getAddress());
      } catch {}
    };
    load();
  }, [provider]);

  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!provider || !ethers.isAddress(tokenAddress)) return;
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== BASE_SEPOLIA_CHAIN_ID) return; // avoid BAD_DATA on wrong network
      try {
        const erc20 = new ethers.Contract(
          tokenAddress,
          ['function decimals() view returns (uint8)'],
          await provider.getSigner()
        );
        const dec = await erc20.decimals();
        setDecimals(Number(dec) || 18);
      } catch {
        setDecimals(18);
      }
    };
    fetchTokenInfo();
  }, [provider, tokenAddress]);

  const refreshBalance = async () => {
    if (
      !provider ||
      !ethers.isAddress(tokenAddress) ||
      !ethers.isAddress(evmAddress)
    )
      return;
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
      addError({
        message: 'Please switch your wallet to Base Sepolia to fetch balance.',
        type: 'error',
        source: 'bridge',
      });
      return;
    }
    try {
      const erc20 = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        await provider.getSigner()
      );
      const bal = await erc20.balanceOf(evmAddress);
      setBalance(BigInt(bal.toString()));
    } catch (err) {
      addError({
        message:
          err instanceof Error ? err.message : 'Failed to fetch EVM balance',
        type: 'error',
        source: 'bridge',
      });
    }
  };

  useEffect(() => {
    refreshBalance();
  }, [evmAddress, tokenAddress]);

  const openOrder = async () => {
    if (!provider || !ethers.isAddress(tokenAddress) || !connectedAccount)
      return;
    try {
      setIsLoading(true);
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
        try {
          // attempt to switch network
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (provider as any).send('wallet_switchEthereumChain', [
            { chainId: ethers.toBeHex(BASE_SEPOLIA_CHAIN_ID) },
          ]);
        } catch (switchErr: any) {
          if (switchErr?.code === 4902) {
            // add chain
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (provider as any).send('wallet_addEthereumChain', [
              {
                chainId: ethers.toBeHex(BASE_SEPOLIA_CHAIN_ID),
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              },
            ]);
          } else {
            addError({
              message: 'Please switch your wallet to Base Sepolia.',
              type: 'error',
              source: 'bridge',
            });
            setIsLoading(false);
            return;
          }
        }
      }
      const value = ethers.parseUnits(amount || '0', decimals);

      // Approve tokens for gateway
      const signer = await provider.getSigner();
      const erc20 = new ethers.Contract(
        tokenAddress,
        ['function approve(address,uint256) returns (bool)'],
        signer
      );
      const approveTx = await erc20.approve(L2_GATEWAY_7683_ADDRESS, value);
      await approveTx.wait();

      // Build OrderData packed bytes as per SDK
      // sender = EVM address (bytes32 padded)
      const sender = padHex32(ethers.getAddress(evmAddress) as `0x${string}`);
      // Use Aztec connected account address as recipient (public mode)
      const aztecRecipient = connectedAccount
        .getAddress()
        .toString() as `0x${string}`;
      const recipient = aztecRecipient;
      const inputToken = padHex32(
        ethers.getAddress(tokenAddress) as `0x${string}`
      );
      // Token on Aztec: default to WETH on Aztec Sepolia
      const outputToken = WETH_ON_AZTEC_SEPOLIA as `0x${string}`;

      const originDomain = 84532; // Base Sepolia chain id
      const destinationDomain = 999999; // aztecSepolia.id in SDK
      const destinationSettler =
        '0x1b4f272b622a493184f6fbb83fc7631f1ce9bad68d4d4c150dc55eed5f100d73' as const;
      const fillDeadline = 2 ** 32 - 1;
      const orderType = 0; // PUBLIC_ORDER
      const data = ('0x' + ''.padStart(64, '0')) as `0x${string}`;

      // Pack fields as in OrderDataEncoder.encode() using abi.encodePacked equivalent
      const pack = (hex: `0x${string}`) => ethers.getBytes(hex);
      const packU256 = (v: bigint) => ethers.getBytes(ethers.toBeHex(v, 32));
      const packU32 = (v: number) => ethers.getBytes(ethers.toBeHex(v, 4));
      const packU8 = (v: number) => ethers.getBytes(ethers.toBeHex(v, 1));
      const orderDataBytes = ethers.concat([
        pack(sender),
        pack(recipient as `0x${string}`),
        pack(inputToken),
        pack(padHex32(outputToken)),
        packU256(value),
        packU256(value),
        packU256(BigInt(Date.now())),
        packU32(originDomain),
        packU32(destinationDomain),
        pack(padHex32(destinationSettler as `0x${string}`)),
        packU32(fillDeadline),
        packU8(orderType),
        pack(data as `0x${string}`),
      ]);
      const orderData = ethers.hexlify(orderDataBytes);

      const gateway = new ethers.Contract(
        L2_GATEWAY_7683_ADDRESS,
        l2Gateway7683Abi,
        signer
      );
      const tx = await gateway.open({
        fillDeadline,
        orderDataType: ORDER_DATA_TYPE,
        orderData,
      });
      await tx.wait();

      addError({
        message: 'Order opened. A filler will complete bridging to Aztec.',
        type: 'info',
        source: 'bridge',
      });
      await refreshBalance();
      setAmount('');
    } catch (err) {
      addError({
        message: err instanceof Error ? err.message : 'Failed to open order',
        type: 'error',
        source: 'bridge',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!connectedAccount) return null;

  return (
    <div className="dripper-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">🌉</span>
        </div>
        <div>
          <h3>Bridge In (Base Sepolia → Aztec)</h3>
          <p>Approve and open an order to bridge tokens into Aztec.</p>
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
                <span className="route-chain">Base Sepolia</span>
                <span className="route-address">{shorten(evmAddress)}</span>
              </div>
              <div className="route-arrow">→</div>
              <div className="route-chip">
                <span className="route-chain">Aztec</span>
                <span className="route-address">{shorten(aztecAddress)}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Token (Base Sepolia)</label>
            <input
              className="form-input"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x..."
              disabled={isLoading}
            />
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
            />
            {balance !== null && (
              <small>Balance: {ethers.formatUnits(balance, decimals)}</small>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={openOrder}
            disabled={
              !amount ||
              !ethers.isAddress(tokenAddress) ||
              !provider ||
              isLoading
            }
          >
            {isLoading ? 'Processing...' : 'Bridge In'}
          </button>
        </div>
      </div>
    </div>
  );
};
