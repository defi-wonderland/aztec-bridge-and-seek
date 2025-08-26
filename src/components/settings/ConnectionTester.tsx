import React, { useState } from 'react';
import { testNodeConnection as testConnection } from '../../utils/connectionTest';

interface ConnectionTesterProps {
  nodeUrl: string;
  onNodeUrlChange: (url: string) => void;
  onTestComplete: (result: 'success' | 'error', message: string) => void;
}

export const ConnectionTester: React.FC<ConnectionTesterProps> = ({ nodeUrl, onNodeUrlChange, onTestComplete }) => {
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await testConnection(nodeUrl);
    onTestComplete(result.success ? 'success' : 'error', result.message);
    setIsTesting(false);
  };

  return (
    <div className="input-with-button">
      <input
        type="url"
        name="nodeUrl"
        className="form-input"
        value={nodeUrl}
        onChange={(e) => onNodeUrlChange(e.target.value)}
        placeholder="https://your-node-url.com"
      />
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={isTesting || !nodeUrl}
        className="test-connection-btn"
      >
        {isTesting ? 'Testing...' : 'Test Connection'}
      </button>
    </div>
  );
};
