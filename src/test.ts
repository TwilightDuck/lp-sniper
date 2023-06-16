import { Assets, Blockfrost, Lucid, Tx, TxComplete, UTxO } from "lucid-cardano";
import { OgmiosProvider } from "./ogmiosProvider.js";
import * as dotenv from "dotenv";
import { Minswap } from "./minswap.js";
import db from "./db.js";
import { Ogmios } from "./ogmios.js";
import _ from "lodash";
import { exit } from "process";
import { Min } from "./constants.js";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { Asset, BlockfrostProvider, Dexter, DexterConfig, LiquidityPool, RequestConfig } from "@indigo-labs/dexter";
import { query } from "winston";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let ogmios = new Ogmios();
let lucid: Lucid;


// This file will buy iUSD with DJED when it's depegged
// Example: Buy 110 iUSD with 100 DJED. Sell 110 iUSD for 105 DJED later.


async function main() {
  dotenv.config();
  lucid = await setupLucid();

  ogmios.setupOgmios();
  await db;

  const blockfrost = new BlockFrostAPI({
    projectId: process.env.BLOCKFROST_KEY || '',
  });

  let asset = "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e";
  let amount = 5_000_000n;

  const assetInfo = await blockfrost.assetsById(asset);

  const { txHash, fee } = { ...await sendMinswapSwapTx(amount, asset) };

  if (txHash === undefined || fee === undefined) {
    return;
  }

  const result = await db.run(
    `INSERT INTO test (asset, dex, amount, fees) VALUES (?, ?, ?, ?)`,
    [
      asset,
      "minswap",
      Number(amount / 1000000n),
      (Number(Min.BATCHER_FEE) + fee) / 1_000_000,
    ]
  );

  console.log(await db.get("SELECT * from test"));

  // now monitor for when the assets arrive in the wallet.

  const oldUtxos = await lucid.provider.getUtxosWithUnit(
    await lucid.wallet.address(),
    asset
  );

  let newUTXO: Array<UTxO> = [];

  while (newUTXO.length === 0) {
    await delay(500);
    const utxos = await lucid.provider.getUtxosWithUnit(
      await lucid.wallet.address(),
      asset
    );
    newUTXO = utxos
      .filter((obj: UTxO) => obj.txHash !== txHash)
      .filter(function (obj: UTxO) {
        return !oldUtxos.some((obj2: UTxO) => obj.txHash == obj2.txHash);
      });
  }

  const purchase: UTxO = newUTXO[0];

  const decimals = BigInt(
    assetInfo.metadata?.decimals == 1
      ? 1
      : Math.pow(10, assetInfo.metadata?.decimals || 0)
  );

  const price =
    Number(amount / 1000000n) / Number(purchase.assets[asset] / decimals);

  await db.run(`UPDATE test SET quantity = ?, price = ? WHERE id = ?`, [
    Number(purchase.assets[asset] / decimals),
    price,
    result.lastID,
  ]);

  console.log(await db.get("SELECT * from test"));
}

async function setupLucid() {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE || '';
  lucid.selectWalletFromSeed(seedPhrase);

  return lucid;
}

async function queryPools() {

  // For each dex we check the price for DJED/iUSD and iUSD/DJED
  const dexterConfig: DexterConfig = {
    metadataMsgBranding: 'Bot Season is here',
  };

  const dexter: Dexter = (new Dexter(dexterConfig))
    .withDataProvider(new BlockfrostProvider({ projectId: "mainnetcTpxiTqsgqYRGZmKTs1dlyRSMHYslIM2", url: "https://cardano-mainnet.blockfrost.io/api/v0" }));

  const djed = new Asset("8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61", "446a65644d6963726f555344", 6);
  const iusd = new Asset("f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880", "69555344", 6);

  console.log(djed);
  // Basic fetch example
  let pools = (await dexter.newFetchRequest()
    .forAllDexs()
    .getLiquidityPools(djed))
    .filter((pool) => {
      let a, b = false;
      if (pool.assetA instanceof Asset) {
        a = pool.assetA.policyId === djed.policyId && pool.assetA.assetNameHex === djed.assetNameHex;
      }

      if (pool.assetB instanceof Asset) {
        b = pool.assetB.policyId === iusd.policyId && pool.assetB.assetNameHex === iusd.assetNameHex;
      }

      return a && b;
    })
    .forEach((pool: LiquidityPool) => {
      console.log(pool);
      console.log(`dex ${pool.dex}`);
      console.log(`price ${pool.price}`);
    });





}

async function sendMinswapSwapTx(amount: bigint, asset: string) {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE || '';
  lucid.selectWalletFromSeed(seedPhrase);

  let assetIn: Assets = { lovelace: amount };
  let assetOut: Assets = { [asset]: 1n };

  let minswap = new Minswap(lucid);
  let tx = await minswap.buildExactInOrder(assetIn, assetOut, 1n);
  const signedTx = await tx.sign().complete();

  let txHash;

  try {
    txHash = await signedTx.submit();
  } catch (error) {
    // Failed for some reason
    //TODO: Handle retry here.
    return;
  }

  if (txHash === null) {
    return;
  }

  console.log(txHash);
  return { txHash: txHash, fee: tx.fee };
}
queryPools();
exit;
