import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const getReadClient = () => {
  return createClient({
    chain: studionet,
    endpoint: '/api/genlayer',
  });
};

export const getWriteClient = (account: `0x${string}`) => {
  return createClient({
    chain: studionet,
    account,
    provider: (window as any).ethereum,
    endpoint: '/api/genlayer',
  });
};
