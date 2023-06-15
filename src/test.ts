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

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let ogmios = new Ogmios();

async function init() {
  dotenv.config();

  ogmios.setupOgmios();
  await db;

  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE;
  lucid.selectWalletFromSeed(seedPhrase);

  const blockfrost = new BlockFrostAPI({
    projectId: process.env.BLOCKFROST_KEY,
  });

  let asset = "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e";
  let amount = 5_000_000n;

  const assetInfo = await blockfrost.assetsById(asset);

  const { txHash, fee } = await sendMinswapSwapTx(amount, asset);
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
    assetInfo.metadata.decimals == 1
      ? 1
      : Math.pow(10, assetInfo.metadata.decimals)
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

async function sendMinswapSwapTx(amount: bigint, asset: string) {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE;
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
    return null;
  }

  if (txHash === null) {
    return null;
  }

  console.log(txHash);
  return { txHash: txHash, fee: tx.fee };
}
init();
exit;
