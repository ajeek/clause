const { createClient } = require('genlayer-js');
const { studionet } = require('genlayer-js/chains');
const client = createClient({ chain: studionet });

async function main() {
  try {
    const stats = await client.readContract({
      address: '0x8abAd60fC59a7fdbC96ff315BE33be7355B66735', // I'll use the default contract address if I can find it
      functionName: 'get_stats',
      args: [],
    });
    console.log("Success:", stats);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
