const { createClient } = require('genlayer-js');
const { studionet } = require('genlayer-js/chains');
const client = createClient({ chain: studionet });

async function main() {
  try {
    const stats = await client.readContract({
      address: '0x0000000000000000000000000000000000000000',
      functionName: 'get_stats',
      args: [],
    });
    console.log("Success:", stats);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
