import { Chain, sepolia } from "viem/chains";

export const EVM_NETWORKS = [
  sepolia,
];

export const DEFAULT_EVM_NETWORK = sepolia;

export const getEVMNetworkById = (id: number) => {
  return EVM_NETWORKS.find(network => network.id === id);
};

export const getEVMNetworkByName = (name: string): Chain | undefined => {
  return EVM_NETWORKS.find(network => network.name.toLowerCase() === name.toLowerCase());
};
