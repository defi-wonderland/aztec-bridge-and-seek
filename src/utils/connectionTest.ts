export const testNodeConnection = async (nodeUrl: string): Promise<{ success: boolean; message: string }> => {
  if (!nodeUrl) {
    return { success: false, message: 'Please enter a node URL first' };
  }

  try {
    const response = await fetch(nodeUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jsonrpc: '2.0', 
        method: 'node_getL1ContractAddresses', 
        params: [], 
        id: 1 
      })
    });
    
    if (response.ok) {
      return { success: true, message: '' };
    } else {
      return { success: false, message: `Node responded with status: ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to node. Please check the URL and ensure the node is running.' };
  }
};