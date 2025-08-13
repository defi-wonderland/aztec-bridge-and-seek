export interface Env {
  AZTEC_NODE_URL: string;
  CONTRACT_ADDRESS: string;
  DEPLOYER_ADDRESS: string;
  DEPLOYMENT_SALT: string;
  PROVER_ENABLED: boolean;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env: Env = {
  AZTEC_NODE_URL: requireEnv('AZTEC_NODE_URL', process.env.AZTEC_NODE_URL),
  CONTRACT_ADDRESS: requireEnv('CONTRACT_ADDRESS', process.env.CONTRACT_ADDRESS),
  DEPLOYER_ADDRESS: requireEnv('DEPLOYER_ADDRESS', process.env.DEPLOYER_ADDRESS),
  DEPLOYMENT_SALT: requireEnv('DEPLOYMENT_SALT', process.env.DEPLOYMENT_SALT),
  PROVER_ENABLED: process.env.PROVER_ENABLED === 'false' ? false : true,
};

export const getEnv = (): Env => {
  return env;
};
