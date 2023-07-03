import { Assets, Blockfrost, Lucid, Tx, TxComplete, UTxO, fromHex, toText } from "lucid-cardano";
import { OgmiosProvider } from "./ogmiosProvider.js";
import * as dotenv from "dotenv";
import { Minswap } from "./minswap.js";
import db from "./db.js";
import { Ogmios } from "./ogmios.js";
import _ from "lodash";
import { exit } from "process";
import { Min, Sundae } from "./constants.js";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { BlockfrostAdapter as MinswapAdapter, PoolState } from "@minswap/blockfrost-adapter";
import { IPoolData, SundaeSDK } from "@sundaeswap/sdk-core";
import { Pool } from "./pool.js";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let ogmios = new Ogmios();
let lucid: Lucid;


async function index() {
  dotenv.config();
  lucid = await setupLucid();

  ogmios.setupOgmios();
  await db;


  const minswapPools = await retrieveMinswapPools();
  const sundaeswapPools = await retrieveSundaeswapPools();

  minswapPools
    .filter(p => {
      const sundae = sundaeswapPools.find(s => s.asset.assetId === p.asset.assetId)

      if (sundae === undefined) {
        return false;
      }

      if (Math.abs(p.getPrice() / sundae.getPrice()) < 0.01) {
        return false;
      }

      return true;
    })
    .filter(p => {
      console.log(`${toText(p.asset.assetId.substring(57))}:  ${p.getPrice()}`);
    })
}



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

async function retrieveSundaeswapPools() {


  const res: {
    data?: {
      poolsPopular: IPoolData[];
    };
  } = await fetch("https://stats.sundaeswap.finance/graphql", {
    method: "POST",
    body: JSON.stringify({
      query: Sundae.popularPoolsQuery,
      variables: {
        pageSize: 30
      },
      operationName: "getPopularPools"
    }),
  }).then((res) => res.json()).catch(reason => console.log(reason));

  if (!res?.data) {
    throw new Error(
      "Something went wrong when trying to fetch pool data. Full response: " +
      JSON.stringify(res)
    );
  }


  return res.data.poolsPopular
    .map(p => Pool.fromSundaeswap(p))
    .filter(p => p.quantityADA > 1_000);

}

async function retrieveMinswapPools() {

  const api = new MinswapAdapter({
    projectId: process.env.BLOCKFROST_KEY!,
    networkId: 1,
  });

  let minswapPools = [];

  for (let i = 1; ; i++) {
    const pools = await api.getPools({
      page: i,
      poolAddress: Min.POOL_ADDRESS_LIST[0],
    });

    if (pools.length === 0) {
      // last page
      break;
    }
    minswapPools.push(pools);
  }

  return minswapPools
    .flat()
    .filter((p: PoolState) => p.assetA === 'lovelace')
    .filter((p: PoolState) => p.reserveA > 1_000)
    .map(p => Pool.fromMinswap(p));
}

async function setupLucid() {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE!;
  lucid.selectWalletFromSeed(seedPhrase);

  return lucid;
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

index();;
