require('dotenv').config();
const express = require('express');
const { Client, Wallet, xrpToDrops } = require('xrpl');

const XRPL_ENDPOINT = process.env.XRPL_ENDPOINT || 'wss://s.altnet.rippletest.net:51233';
const XRPL_SEED = process.env.XRPL_SEED;
if (!XRPL_SEED) console.warn('⚠️ XRPL_SEED missing. Add it to .env');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/payments/submit', async (req, res) => {
  try {
    const { to, amountXRP = '1' } = req.body;
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
      Memos: [{
        Memo: {
          MemoType: Buffer.from('ace_policy_id').toString('hex'),
          MemoData: Buffer.from(process.env.ACE_POLICY_ID || 'ace:v1:default').toString('hex')
        }
      }]
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    await client.disconnect();

    res.json({ tx_hash: result.result.hash, engine_result: result.result.engine_result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(8080, () => console.log('✅ Settlement API running on :8080'));
