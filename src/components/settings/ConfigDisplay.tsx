import React from 'react';
import { NetworkConfig } from '../../config/networks/types';

interface ConfigDisplayProps {
  config: NetworkConfig;
  title: string;
}

export const ConfigDisplay: React.FC<ConfigDisplayProps> = ({ config, title }) => (
  <div className="config-display">
    <h4>{title}</h4>
    <div className="config-grid">
      <div className="config-row">
        <span className="config-label">Node URL</span>
        <span className="config-value">{config?.nodeUrl || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Contract Address</span>
        <span className="config-value">{config?.contractAddress || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Token Contract</span>
        <span className="config-value">{config?.tokenContractAddress || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Dripper Contract</span>
        <span className="config-value">{config?.dripperContractAddress || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Deployer Address</span>
        <span className="config-value">{config?.deployerAddress || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Deployment Salt</span>
        <span className="config-value">{config?.deploymentSalt || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Dripper Salt</span>
        <span className="config-value">{config?.dripperDeploymentSalt || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Token Salt</span>
        <span className="config-value">{config?.tokenDeploymentSalt || 'Not configured'}</span>
      </div>
      <div className="config-row">
        <span className="config-label">Prover Enabled</span>
        <span className="config-value">{config?.proverEnabled ? 'Yes' : 'No'}</span>
      </div>
    </div>
  </div>
);
