const { encodeFunctionData } = require('viem');
const abi = [{ type: 'function', name: 'get_stats', inputs: [], outputs: [] }];
const data = encodeFunctionData({ abi, functionName: 'get_stats' });
console.log(data);
