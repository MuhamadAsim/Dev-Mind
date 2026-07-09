// ============================================================
// Graphify Context Layer Verification Script
// ============================================================
import { GraphService } from './graphService';

async function runVerification() {
  console.log('====================================================');
  console.log('Graphify Context Layer Verification');
  console.log('====================================================');

  const graphService = new GraphService();
  
  console.log('1. Discovering MCP capabilities...');
  try {
    const capabilities = await graphService.getCapabilities();
    console.log('Capabilities received:', JSON.stringify(capabilities, null, 2));

    const activeTools = Object.entries(capabilities)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    if (activeTools.length > 0) {
      console.log(`Success! Active tools discovered: ${activeTools.join(', ')}`);
    } else {
      console.log('Warning: No tools discovered. MCP server might be offline or not returning tools.');
    }
  } catch (err: any) {
    console.error('Error discovering capabilities:', err.message || err);
  }

  console.log('\n2. Testing getGraphStatus with a dummy repo ID...');
  try {
    // This will check if the repo exists in MongoDB. Since it doesn't exist, it should return offline.
    const status = await graphService.getGraphStatus('000000000000000000000000');
    console.log('Dummy repo graph status:', JSON.stringify(status, null, 2));
  } catch (err: any) {
    console.error('Error checking graph status:', err.message || err);
  }

  console.log('\n====================================================');
  console.log('Verification finished.');
  console.log('====================================================');
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
