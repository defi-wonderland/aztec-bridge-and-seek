export interface Env {
  AZTEC_NODE_URL: string;
  CONTRACT_ADDRESS: string;
  DRIPPER_CONTRACT_ADDRESS: string;
  TOKEN_CONTRACT_ADDRESS: string;
  DEPLOYER_ADDRESS: string;
  DEPLOYMENT_SALT: string;
  DRIPPER_DEPLOYMENT_SALT: string;
  TOKEN_DEPLOYMENT_SALT: string;
  PROVER_ENABLED: boolean;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env: Env = {
  AZTEC_NODE_URL: requireEnv('VITE_AZTEC_NODE_URL', import.meta.env.VITE_AZTEC_NODE_URL),
  CONTRACT_ADDRESS: requireEnv('VITE_CONTRACT_ADDRESS', import.meta.env.VITE_CONTRACT_ADDRESS),
  DRIPPER_CONTRACT_ADDRESS: requireEnv('VITE_DRIPPER_CONTRACT_ADDRESS', import.meta.env.VITE_DRIPPER_CONTRACT_ADDRESS),
  TOKEN_CONTRACT_ADDRESS: requireEnv('VITE_TOKEN_CONTRACT_ADDRESS', import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS),
  DEPLOYER_ADDRESS: requireEnv('VITE_DEPLOYER_ADDRESS', import.meta.env.VITE_DEPLOYER_ADDRESS),
  DEPLOYMENT_SALT: requireEnv('VITE_DEPLOYMENT_SALT', import.meta.env.VITE_DEPLOYMENT_SALT),
  DRIPPER_DEPLOYMENT_SALT: requireEnv('VITE_DRIPPER_DEPLOYMENT_SALT', import.meta.env.VITE_DRIPPER_DEPLOYMENT_SALT),
  TOKEN_DEPLOYMENT_SALT: requireEnv('VITE_TOKEN_DEPLOYMENT_SALT', import.meta.env.VITE_TOKEN_DEPLOYMENT_SALT),
  PROVER_ENABLED: import.meta.env.PROVER_ENABLED === 'false' ? false : true,
};

export const getEnv = (): Env => {
  return env;
};
