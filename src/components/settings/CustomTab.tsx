import React, { useState, useEffect } from 'react';
import { useConfig } from '../../hooks';
import { validateConfig } from '../../utils';
import { ConnectionTester } from './ConnectionTester';

interface CustomConfig {
  nodeUrl: string;
  contractAddress: string;
  dripperContractAddress: string;
  tokenContractAddress: string;
  deployerAddress: string;
  deploymentSalt: string;
  dripperDeploymentSalt: string;
  tokenDeploymentSalt: string;
  proverEnabled: boolean;
}

export const CustomTab: React.FC = () => {
  const [customConfig, setCustomConfig] = useState<CustomConfig>({
    nodeUrl: '',
    contractAddress: '',
    dripperContractAddress: '',
    tokenContractAddress: '',
    deployerAddress: '',
    deploymentSalt: '',
    dripperDeploymentSalt: '',
    tokenDeploymentSalt: '',
    proverEnabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');
  
  const { setCustomConfig: saveCustomConfig, getCustomConfig, clearCustomConfig } = useConfig();

  const handleCustomConfigChange = (field: string, value: string | boolean) => {
    setCustomConfig(prev => ({ ...prev, [field]: value }));
    
    if (field === 'nodeUrl') {
      setConnectionTestResult('idle');
      setConnectionErrorMessage('');
    }
  };

  const handleTestComplete = (result: 'success' | 'error', message: string) => {
    setConnectionTestResult(result);
    setConnectionErrorMessage(message);
  };

  const handleSaveCustomConfig = () => {
    if (!validateConfig(customConfig)) {
      alert('Please fill out all fields and ensure they are valid');
      return;
    }

    if (connectionTestResult !== 'success') {
      alert('Please test the node connection before saving');
      return;
    }

    setIsSaving(true);
    saveCustomConfig(customConfig);

    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  const handleRemoveCustomConfig = () => {
    if (confirm('Are you sure you want to remove the custom configuration? This action cannot be undone.')) {
      clearCustomConfig();
      setCustomConfig({
        nodeUrl: '',
        contractAddress: '',
        dripperContractAddress: '',
        tokenContractAddress: '',
        deployerAddress: '',
        deploymentSalt: '',
        dripperDeploymentSalt: '',
        tokenDeploymentSalt: '',
        proverEnabled: true,
      });
      setConnectionTestResult('idle');
      setConnectionErrorMessage('');
    }
  };

  useEffect(() => {
    const savedConfig = getCustomConfig();
    if (savedConfig) {
      setCustomConfig(savedConfig);
    }
  }, [getCustomConfig]);

  return (
    <div className="config-display">
      <h4>Custom Configuration</h4>
      <div className="config-grid">
        <div className="config-row">
          <label className="config-label">Node URL</label>
          <ConnectionTester 
            nodeUrl={customConfig.nodeUrl}
            onNodeUrlChange={(url) => handleCustomConfigChange('nodeUrl', url)}
            onTestComplete={handleTestComplete}
          />
        </div>
        {connectionTestResult === 'success' && (
          <div className="connection-success">
            ✅ Node is reachable and responding
          </div>
        )}
        {connectionTestResult === 'error' && (
          <div className="connection-error">
            ❌ {connectionErrorMessage}
          </div>
        )}
        <div className="config-row">
          <label className="config-label">Contract Address</label>
          <input
            type="text"
            className="form-input"
            value={customConfig.contractAddress}
            onChange={(e) => handleCustomConfigChange('contractAddress', e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="config-row">
          <label className="config-label">Token Contract</label>
          <input
            type="text"
            className="form-input"
            value={customConfig.tokenContractAddress}
            onChange={(e) => handleCustomConfigChange('tokenContractAddress', e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="config-row">
          <label className="config-label">Dripper Contract</label>
          <input
            type="text"
            className="form-input"
            value={customConfig.dripperContractAddress}
            onChange={(e) => handleCustomConfigChange('dripperContractAddress', e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="config-row">
          <label className="config-label">Deployer Address</label>
          <input
            type="text"
            className="form-input"
            value={customConfig.deployerAddress}
            onChange={(e) => handleCustomConfigChange('deployerAddress', e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="config-row">
          <label className="config-label">Deployment Salt</label>
          <input
            type="text"
            className="form-input"
            value={customConfig.deploymentSalt}
            onChange={(e) => handleCustomConfigChange('deploymentSalt', e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="config-row">
          <label className="config-label">Dripper Salt</label>
          <input
            type="text"
            className="form-input"
            value={customConfig.dripperDeploymentSalt}
            onChange={(e) => handleCustomConfigChange('dripperDeploymentSalt', e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="config-row">
          <label className="config-label">Token Salt</label>
          <input
            type="text"
            className="form-input"
            value={customConfig.tokenDeploymentSalt}
            onChange={(e) => handleCustomConfigChange('tokenDeploymentSalt', e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="config-row">
          <label className="config-label">Prover Enabled</label>
          <input
            type="checkbox"
            checked={customConfig.proverEnabled}
            onChange={(e) => handleCustomConfigChange('proverEnabled', e.target.checked)}
            className="checkbox-input"
          />
        </div>
      </div>
      <br />
      <div className="form-actions">
        <button className="btn btn-danger" onClick={handleRemoveCustomConfig}>
          Delete
        </button>
        <button className="btn btn-primary" onClick={handleSaveCustomConfig} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
