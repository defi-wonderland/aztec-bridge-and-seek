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
  WALLETCONNECT_PROJECT_ID?: string;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env: Env = {
  // Provide a sensible default for local development to avoid hard crashes when not set
  AZTEC_NODE_URL: (process.env.AZTEC_NODE_URL &&
  process.env.AZTEC_NODE_URL !== ''
    ? process.env.AZTEC_NODE_URL
    : 'http://localhost:8080') as string,
  CONTRACT_ADDRESS: requireEnv(
    'CONTRACT_ADDRESS',
    process.env.CONTRACT_ADDRESS
  ),
  DRIPPER_CONTRACT_ADDRESS: requireEnv(
    'DRIPPER_CONTRACT_ADDRESS',
    process.env.DRIPPER_CONTRACT_ADDRESS
  ),
  TOKEN_CONTRACT_ADDRESS: requireEnv(
    'TOKEN_CONTRACT_ADDRESS',
    process.env.TOKEN_CONTRACT_ADDRESS
  ),
  DEPLOYER_ADDRESS: requireEnv(
    'DEPLOYER_ADDRESS',
    process.env.DEPLOYER_ADDRESS
  ),
  DEPLOYMENT_SALT: requireEnv('DEPLOYMENT_SALT', process.env.DEPLOYMENT_SALT),
  DRIPPER_DEPLOYMENT_SALT: requireEnv(
    'DRIPPER_DEPLOYMENT_SALT',
    process.env.DRIPPER_DEPLOYMENT_SALT
  ),
  TOKEN_DEPLOYMENT_SALT: requireEnv(
    'TOKEN_DEPLOYMENT_SALT',
    process.env.TOKEN_DEPLOYMENT_SALT
  ),
  PROVER_ENABLED: process.env.PROVER_ENABLED === 'false' ? false : true,
  WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
};

export const getEnv = (): Env => {
  return env;
};
