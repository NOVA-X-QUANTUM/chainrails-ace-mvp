// Phase 1 — XRPL Settlement API (CommonJS)
require('dotenv').config();
const express = require('express');
const { Client, Wallet, xrpToDrops } = require('xrpl');

// ENV
const XRPL_ENDPOINT = process.env.XRPL_ENDPOINT || 'wss://s.altnet.rippletest.net:51233';
const XRPL_SEED = process.env.XRPL_SEED;
const ACE_POLICY_ID = process.env.ACE_POLICY_ID || 'ace:v1:default';

if (!XRPL_SEED) {
  console.warn('⚠️  XRPL_SEED missing. Add it to your .env (testnet seed).');
}

const app = express();
app.use(express.json());

// Health
app.get('/health', (_req, res) => {
  res.json({ ok: true, phase: 1 });
});

// Helper: public address (SAFE to show on video)
app.get('/address', (_req, res) => {
  try {
    if (!XRPL_SEED) return res.status(400).json({ error: 'XRPL_SEED not set' });
    const wallet = Wallet.fromSeed(XRPL_SEED);
    res.json({ address: wallet.address });
  } catch (e) {
    res.status(500).json({ error: e.message || 'address error' });
  }
});

// Submit XRPL payment (self-payment works great for demo reliability)
app.post('/payments/submit', async (req, res) => {
  try {
    const { to, amountXRP = '1' } = req.body || {};
    if (!XRPL_SEED) return res.status(400).json({ error: 'XRPL_SEED not set in .env' });
    if (!to) return res.status(400).json({ error: '`to` required' });

    const client = new Client(XRPL_ENDPOINT);
    await client.connect();

    const wallet = Wallet.fromSeed(XRPL_SEED);

    const tx = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: to,
      Amount: xrpToDrops(amountXRP),
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('ace_policy_id').toString('hex'),
            MemoData: Buffer.from(ACE_POLICY_ID).toString('hex')
          }
        }
      ]
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    res.json({
      tx_hash: result.result.hash,
      engine_result: result.result.engine_result
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'submit error' });
  }
});

// Boot
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(PORT, () => console.log(`✅ Settlement API (Phase 1) running on :${PORT}`));