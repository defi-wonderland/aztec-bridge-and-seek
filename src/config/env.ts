export interface Env {
  AZTEC_NODE_URL: string;
  VOTING_CONTRACT_ADDRESS: string;
  DRIPPER_CONTRACT_ADDRESS: string;
  TOKEN_CONTRACT_ADDRESS: string;
  DEPLOYER_ADDRESS: string;
  VOTING_DEPLOYMENT_SALT: string;
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
  AZTEC_NODE_URL: requireEnv('AZTEC_NODE_URL', process.env.AZTEC_NODE_URL),
  VOTING_CONTRACT_ADDRESS: requireEnv('VOTING_CONTRACT_ADDRESS', process.env.VOTING_CONTRACT_ADDRESS),
  DRIPPER_CONTRACT_ADDRESS: requireEnv('DRIPPER_CONTRACT_ADDRESS', process.env.DRIPPER_CONTRACT_ADDRESS),
  TOKEN_CONTRACT_ADDRESS: requireEnv('TOKEN_CONTRACT_ADDRESS', process.env.TOKEN_CONTRACT_ADDRESS),
  DEPLOYER_ADDRESS: requireEnv('DEPLOYER_ADDRESS', process.env.DEPLOYER_ADDRESS),
  VOTING_DEPLOYMENT_SALT: requireEnv('VOTING_DEPLOYMENT_SALT', process.env.VOTING_DEPLOYMENT_SALT),
  DRIPPER_DEPLOYMENT_SALT: requireEnv('DRIPPER_DEPLOYMENT_SALT', process.env.DRIPPER_DEPLOYMENT_SALT),
  TOKEN_DEPLOYMENT_SALT: requireEnv('TOKEN_DEPLOYMENT_SALT', process.env.TOKEN_DEPLOYMENT_SALT),
  PROVER_ENABLED: process.env.PROVER_ENABLED === 'false' ? false : true,
};

export const getEnv = (): Env => {
  return env;
};
