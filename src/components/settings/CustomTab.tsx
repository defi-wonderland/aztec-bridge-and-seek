import React, { useState, useEffect } from 'react';
import { useConfig } from '../../hooks';
import { validateConfig } from '../../utils';
import { ConnectionTester } from './ConnectionTester';
import { testNodeConnection } from '../../utils/connectionTest';
import { useNotification } from '../../providers/NotificationProvider';

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

interface ConfigField {
  key: keyof CustomConfig;
  label: string;
  type: 'text' | 'checkbox';
  placeholder?: string;
  isSpecial?: boolean;
}

const configFields: ConfigField[] = [
  { key: 'nodeUrl', label: 'Node URL', type: 'text', isSpecial: true },
  { key: 'contractAddress', label: 'Contract Address', type: 'text', placeholder: '0x...' },
  { key: 'tokenContractAddress', label: 'Token Contract', type: 'text', placeholder: '0x...' },
  { key: 'dripperContractAddress', label: 'Dripper Contract', type: 'text', placeholder: '0x...' },
  { key: 'deployerAddress', label: 'Deployer Address', type: 'text', placeholder: '0x...' },
  { key: 'deploymentSalt', label: 'Deployment Salt', type: 'text', placeholder: '0x...' },
  { key: 'dripperDeploymentSalt', label: 'Dripper Salt', type: 'text', placeholder: '0x...' },
  { key: 'tokenDeploymentSalt', label: 'Token Salt', type: 'text', placeholder: '0x...' },
  { key: 'proverEnabled', label: 'Prover Enabled', type: 'checkbox' },
];

const DEFAULT_CONFIG: CustomConfig = {
  nodeUrl: '',
  contractAddress: '',
  dripperContractAddress: '',
  tokenContractAddress: '',
  deployerAddress: '',
  deploymentSalt: '',
  dripperDeploymentSalt: '',
  tokenDeploymentSalt: '',
  proverEnabled: true,
};

export const CustomTab: React.FC = () => {
  const [customConfig, setCustomConfig] = useState<CustomConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  
  const { setCustomConfig: saveCustomConfig, getCustomConfig, clearCustomConfig } = useConfig();
  const { addNotification } = useNotification();

  const handleCustomConfigChange = (field: string, value: string | boolean) => {
    setCustomConfig(prev => ({ ...prev, [field]: value }));
    
    if (field === 'nodeUrl') {
      setConnectionTestResult('idle');
    }
  };

  const handleTestComplete = (result: 'success' | 'error', message: string) => {
    setConnectionTestResult(result);
    
    // Show notification
    if (result === 'success') {
      addNotification({
        message: 'Node is reachable and responding',
        type: 'success',
        source: 'settings'
      });
    } else {
      addNotification({
        message: `Connection failed: ${message}`,
        type: 'error',
        source: 'settings'
      });
    }
  };


  const handleSaveCustomConfig = async () => {
    if (!validateConfig(customConfig)) {
      addNotification({
        message: 'Please fill out all fields and ensure they are valid',
        type: 'warning',
        source: 'settings'
      });
      return;
    }

    if (connectionTestResult !== 'success') {
      // Test the connection first
      setIsSaving(true);
      const result = await testNodeConnection(customConfig.nodeUrl);
      handleTestComplete(result.success ? 'success' : 'error', result.message);
      
      if (!result.success) {
        setIsSaving(false);
        return;
      }
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
      setCustomConfig(DEFAULT_CONFIG);
      setConnectionTestResult('idle');
    }
  };

  useEffect(() => {
    const savedConfig = getCustomConfig();
    if (savedConfig) {
      setCustomConfig(savedConfig);
    }
  }, [getCustomConfig]);

  const renderField = (field: ConfigField) => {
    if (field.isSpecial) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ConnectionTester 
            nodeUrl={customConfig[field.key] as string}
            onNodeUrlChange={(url) => handleCustomConfigChange(field.key, url)}
            onTestComplete={handleTestComplete}
          />
          {connectionTestResult === 'success' && (
            <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
          )}
        </div>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={customConfig[field.key] as boolean}
          onChange={(e) => handleCustomConfigChange(field.key, e.target.checked)}
          className="checkbox-input"
        />
      );
    }

    return (
      <input
        type="text"
        className="form-input"
        value={customConfig[field.key] as string}
        onChange={(e) => handleCustomConfigChange(field.key, e.target.value)}
        placeholder={field.placeholder}
      />
    );
  };

  return (
    <div className="config-display">
      <h4>Custom Configuration</h4>
      <div className="config-grid">
        {configFields.map((field) => (
          <div key={field.key} className="config-row">
            <label className="config-label">{field.label}</label>
            {renderField(field)}
          </div>
        ))}
      </div>
      <br />
      <div className="form-actions">
        <button className="btn btn-danger" onClick={handleRemoveCustomConfig}>
          Delete
        </button>
        <button className="btn btn-primary" onClick={handleSaveCustomConfig} disabled={isSaving}>
          {isSaving ? 'Saving...' : connectionTestResult !== 'success' ? 'Test and Save' : 'Save'}
        </button>
      </div>
    </div>
  );
};
