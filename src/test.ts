import { Assets, Lucid, UTxO, toText } from "lucid-cardano";
import { OgmiosProvider } from "./ogmiosProvider.js";
import * as dotenv from "dotenv";
import { Minswap } from "./minswap.js";
import db from "./db.js";
import { Ogmios } from "./ogmios.js";
import _, { lowerCase } from "lodash";
import { Min, Sundae } from "./constants.js";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import {
  BlockfrostAdapter as MinswapAdapter,
  PoolState,
} from "@minswap/blockfrost-adapter";
import { IPoolData, SundaeSDK } from "@sundaeswap/sdk-core";
import { Pool } from "./pool.js";
import Big from "big.js";
import { calculateAmountIn, calculateProfit } from "./model.js";



const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let ogmios = new Ogmios();
let lucid: Lucid;

async function index() {
  dotenv.config();
  lucid = await setupLucid();

  ogmios.setupOgmios();
  await db;

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));

    const minswapPools = await retrieveMinswapPools();
    const sundaeswapPools = await retrieveSundaeswapPools();


    minswapPools
      .filter((p) => getQuoteTokens().find((q) => q.unit === p.asset.assetId))
      .filter((p) => {
        const sundae = sundaeswapPools.find(
          (s) => s.asset.assetId === p.asset.assetId
        );

        if (sundae === undefined) {
          return false;
        }
        return true;
      })
      .forEach((p) => {
        const s = sundaeswapPools.find(
          (s) => s.asset.assetId === p.asset.assetId
        );

        if (s === undefined) {
          return;
        }

        let amount01 = calculateAmountIn(
          p.reserveA,
          p.reserveB,
          s.reserveA,
          s.reserveB,
          c
        );
        let amount10 = calculateAmountIn(
          s.reserveA,
          s.reserveB,
          p.reserveA,
          p.reserveB,
          c
        );
        let profit01 = calculateProfit(
          amount01,
          p.reserveA,
          p.reserveB,
          s.reserveA,
          s.reserveB,
          c
        );
        let profit10 = calculateProfit(
          amount10,
          s.reserveA,
          s.reserveB,
          p.reserveA,
          p.reserveB,
          c
        );

        let amountIn: Big;
        let profit: Big;
        let pool: Pool;
        if (amount01.gt(ZERO)) {
          amountIn = amount01;
          profit = profit01;
          pool = p;
          console.log(
            `${toText(p.asset.assetId.substring(57))}: Minswap:  ${p
              .getPrice()
              .toFixed(6)}, Sundae: ${s.getPrice().toFixed(6)}`
          );
          console.log("-----------------------------------------------");
          console.log(`Profit 1: ${amountIn} in for ${profit} profit`);
        } else if (amount10.gt(ZERO)) {
          amountIn = amount10;
          profit = profit10;
          pool = s;
          console.log(
            `${toText(p.asset.assetId.substring(57))}: Minswap:  ${p
              .getPrice()
              .toFixed(6)}, Sundae: ${s.getPrice().toFixed(6)}`
          );
          console.log("-----------------------------------------------");
          console.log(`Profit 2: ${amountIn} in for ${profit} profit`);
        } else {
          return;
        }

        // const priceDif =
        //   Math.abs(p.getPrice() - s.getPrice()) /
        //   ((p.getPrice() + s.getPrice()) / 2);
        // console.log("Price difference is " + (priceDif * 100).toFixed(2) + "%");
        // let poolRaise = priceDif / 2;
        // let poolBuyPercentage = poolRaise / 2;

        // // In higher pool sell token for ada.
        // // in lower pool buy token with ada.

        // // Find pool with lowest price
        // let lowestPool = s;
        // let highestPool = p;
        // if (p.getPrice() < s.getPrice()) {
        //   lowestPool = p;
        //   highestPool = s;
        // }

        // let amountToBuy =
        //   (BigInt((poolBuyPercentage * 1000).toFixed(0)) * lowestPool.reserveA) /
        //   1000n;

        // // If bigger than 100 ADA.
        // if (amountToBuy > 100_000_000n) {
        //   amountToBuy = 100_000_000n;
        // }

        // console.log(
        //   `Buying ${amountToBuy / 1_000_000n} ADA of ${toText(
        //     lowestPool.asset.assetId.substring(57)
        //   )} from ${lowestPool.dex}`
        // );

        // swap(amountToBuy, lowestPool, highestPool).then(() => {
        //   console.log("Success?!");
        // });
      });
  }
}

async function swap(amount: bigint, lowestPool: Pool, highestPool: Pool) {
  dotenv.config();
  lucid = await setupLucid();

  ogmios.setupOgmios();
  await db;

  const blockfrost = new BlockFrostAPI({
    projectId: process.env.BLOCKFROST_KEY || "",
  });

  const assetInfo = await blockfrost.assetsById(lowestPool.assetid);

  const { txHash, fee } = {
    ...(await sendMinswapSwapTx(amount, lowestPool.assetid)),
  };

  if (txHash === undefined || fee === undefined) {
    console.log("Failed to buy!");
    return;
  }

  const result = await db.run(
    `INSERT INTO test (asset, dex, amount, fees) VALUES (?, ?, ?, ?)`,
    [
      lowestPool.assetid,
      lowestPool.dex,
      Number(amount / 1000000n),
      (Number(Min.BATCHER_FEE) + fee) / 1_000_000,
    ]
  );

  console.log(await db.get("SELECT * from test"));

  // now monitor for when the assets arrive in the wallet.

  const oldUtxos = await lucid.provider.getUtxosWithUnit(
    await lucid.wallet.address(),
    lowestPool.assetid
  );

  let newUTXO: Array<UTxO> = [];

  while (newUTXO.length === 0) {
    await delay(500);
    const utxos = await lucid.provider.getUtxosWithUnit(
      await lucid.wallet.address(),
      lowestPool.assetid
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
    Number(amount / 1000000n) /
    Number(purchase.assets[lowestPool.assetid] / decimals);

  await db.run(`UPDATE test SET quantity = ?, price = ? WHERE id = ?`, [
    Number(purchase.assets[lowestPool.assetid] / decimals),
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
        pageSize: 50,
      },
      operationName: "getPopularPools",
    }),
  })
    .then((res) => res.json())
    .catch((reason) => console.log(reason));

  if (!res?.data) {
    throw new Error(
      "Something went wrong when trying to fetch pool data. Full response: " +
        JSON.stringify(res)
    );
  }

  return res.data.poolsPopular.map((p) => Pool.fromSundaeswap(p));
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
    .map((p) => Pool.fromMinswap(p));
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
  const seedPhrase = process.env.SEED_PHRASE || "";
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

index();
