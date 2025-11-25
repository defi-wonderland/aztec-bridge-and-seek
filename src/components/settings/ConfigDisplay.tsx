import React from 'react';
import { NetworkConfig } from '../../config/networks/types';

interface ConfigDisplayProps {
  config: NetworkConfig;
  title: string;
}

interface ConfigField {
  key: keyof NetworkConfig;
  label: string;
  formatter?: (value: any) => string;
}

const configFields: ConfigField[] = [
  { key: 'nodeUrl', label: 'Node URL' },
  {
    key: 'tokenContractAddress',
    label: 'Token Contract',
    formatter: (value: any) => value?.toString()
  },
  {
    key: 'dripperContractAddress',
    label: 'Dripper Contract',
    formatter: (value: any) => value?.toString()
  },
  { key: 'deployerAddress', label: 'Deployer Address' },
  {
    key: 'dripperDeploymentSalt',
    label: 'Dripper Salt',
    formatter: (value: any) => value?.toString()
  },
  {
    key: 'tokenDeploymentSalt',
    label: 'Token Salt',
    formatter: (value: any) => value?.toString()
  },
  {
    key: 'proverEnabled',
    label: 'Prover Enabled',
    formatter: (value: boolean) => value ? 'Yes' : 'No'
  }
];

export const ConfigDisplay: React.FC<ConfigDisplayProps> = ({ config, title }) => (
  <div className="config-display">
    <h4>{title}</h4>
    <div className="config-grid">
      {configFields.map(({ key, label, formatter }) => {
        const value = config?.[key];
        const displayValue = formatter ? formatter(value) : String(value || '');

        return (
          <div key={key} className="config-row">
            <span className="config-label">{label}</span>
            <span className="config-value">{displayValue || 'Not configured'}</span>
          </div>
        );
      })}
    </div>
  </div>
);
