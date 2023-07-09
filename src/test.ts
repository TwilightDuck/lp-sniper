import { Assets, Blockfrost, Lucid, UTxO } from "lucid-cardano";
import { OgmiosProvider } from "./ogmiosProvider.js";
import * as dotenv from "dotenv";
import { Minswap } from "./dex/minswap.js";
import { Ogmios } from "./ogmios.js";
import _ from "lodash";
import { Min, Sundae } from "./constants.js";
import { BlockfrostAdapter as MinswapAdapter } from "@minswap/blockfrost-adapter";
import { IPoolData } from "@sundaeswap/sdk-core";
import { Pool } from "./pool.js";
import { getTokens } from "./tokens.js";
import { Asset, Circle, Token, Trade } from "./types.js";
import {
  DexterConfig,
  RequestConfig,
  Dexter,
  LiquidityPool,
  BlockfrostProvider,
  KupoProvider,
} from "@indigo-labs/dexter";
import Big from "big.js";
import { decimals } from "./constants";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let ogmios = new Ogmios();
let lucid: Lucid;
let tokens: Asset[];

async function index() {
  dotenv.config();
  tokens = await getTokens();

  lucid = await setupLucid();

  // ogmios.setupOgmios();
  // await db;

  const dexterConfig: DexterConfig = {
    shouldFetchMetadata: true, // Whether to fetch asset metadata (Best to leave this `true` for accurate pool info)
    shouldFallbackToApi: false, // Only use when using Blockfrost or Kupo as data providers. On failure, fallback to the DEX API to grab necessary data
    shouldSubmitOrders: false, // Allow Dexter to submit orders from swap requests. Useful during development
    metadataMsgBranding: "Dexter", // Prepend branding name in Tx message
  };
  const requestConfig: RequestConfig = {
    timeout: 120000, // How long outside network requests have to reply
    proxyUrl: "", // URL to prepend to all outside URLs. Useful when dealing with CORs
  };

  const dexter: Dexter = new Dexter(dexterConfig, requestConfig);

  // Basic fetch example
  let pools: LiquidityPool[] = await dexter
    // .withDataProvider(
    //   new BlockfrostProvider({
    //     url: "https://cardano-mainnet.blockfrost.io/api/v0",
    //     projectId: process.env.BLOCKFROST_KEY || "",
    //   })
    // )
    .withDataProvider(new KupoProvider({ url: "http://192.168.1.73:1442" }))
    .newFetchRequest()
    // .onAllDexs()
    .onDexs(["WingRiders", 'SundaeSwap'])
    .getLiquidityPools();

  console.log(`Minswap:  ${pools.filter((p) => p.dex == "Minswap").length}`);
  console.log(`SundaeSwap:  ${pools.filter((p) => p.dex == "SundaeSwap").length}`);
  console.log(`MuesliSwap:  ${pools.filter((p) => p.dex == "MuesliSwap").length}`);
  console.log(`VyFinance:  ${pools.filter((p) => p.dex == "VyFinance").length}`);
  console.log(`WingRiders:  ${pools.filter((p) => p.dex == "WingRiders").length}`);
  console.log(`Total:  ${pools.length}`);



  const trades = findArb(pools, "lovelace", "lovelace", 10, pools, ["lovelace"], []);

  console.log(`Trades: ${trades.length}`)

  if (trades.length === 0) {
    return;
  }
  console.log("max_profit:", trades[0]["p"]);
  const trade = trades[0];

  // 1 is min profit
  if (trade && Number(trade["profit"]) / Math.pow(10, 6) >= 1) {
    console.log(trade);
  }
}

async function setupLucid() {
  // const lucid: Lucid = await Lucid.new(
  //   new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
  //   "Mainnet"
  // );

  const lucid: Lucid = await Lucid.new(
    new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    ),
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

function findArb(
  pools: LiquidityPool[],
  tokenIn: Token,
  tokenOut: Token,
  maxHops: number,
  currentPools: LiquidityPool[],
  path: Token[],
  bestTrades: Trade[],
  count: number = 20
): Trade[] {
  for (let i = 0; i < pools.length; i++) {
    let newPath = [...path];
    let pool = pools[i];

    const assetADecimal = pool.assetA == "lovelace" ? 6 : pool.assetA.decimals;
    const assetBDecimal = pool.assetB == "lovelace" ? 6 : pool.assetB.decimals;

    if (pool.assetA != tokenIn && pool.assetB != tokenIn) {
      continue;
    }
    if (
      BigInt(pool.reserveA) / 10n ** BigInt(assetADecimal) < 1n ||
      BigInt(pool.reserveB) / 10n ** BigInt(assetBDecimal) < 1n
    ) {
      continue;
    }

    let tempOut: Token;


    if (tokenIn == pool.assetA) {
      tempOut = pool.assetB;
    } else {
      tempOut = pool.assetA;
    }




    newPath.push(tempOut);

    if (tempOut == tokenOut && path.length > 2) {
      console.log(`Arb ${i}`);


      let [Ea, Eb] = getEaEb(tokenOut, [...currentPools, pool]);
      let newTrade: Trade = {
        route: [...currentPools, pool],
        path: newPath,
        Ea: Ea,
        Eb: Eb,
      };

      if (Ea && Eb && Ea < Eb) {
        newTrade.optimalAmount = getOptimalAmount(Ea, Eb);

        if (newTrade.optimalAmount && newTrade.optimalAmount > 0) {
          newTrade.outputAmount = getAmountOut(newTrade.optimalAmount, Ea, Eb);
          newTrade.profit =
            (newTrade.outputAmount ? newTrade.outputAmount : 0) -
            newTrade.optimalAmount;
          newTrade.p =
            Math.floor(newTrade.profit ? newTrade.profit : 0) /
            Math.pow(10, tokenOut == "lovelace" ? 6 : tokenOut.decimals);
        } else {
          continue;
        }
        bestTrades = sortTrades(bestTrades, newTrade);
        bestTrades.reverse();
        bestTrades = bestTrades.slice(0, count);
      }
    } else if (maxHops > 1 && pools.length > 1) {
      pools.splice(i, 1);
      bestTrades = findArb(
        pools,
        tempOut,
        tokenOut,
        maxHops - 1,
        [...currentPools, pool],
        newPath,
        bestTrades,
        count
      );
    }
  }
  return bestTrades;
}

function sortTrades(trades: Trade[], newTrade: Trade): Trade[] {
  trades.push(newTrade);
  return trades.sort((a: Trade, b: Trade) => (a.profit || 0) - (b.profit || 0));
}

function adjustReserve(token: Token, reserve: bigint) {
  const decimals = token == "lovelace" ? 6 : token.decimals;
  return reserve / BigInt(Math.pow(10, decimals));
}

function getEaEb(tokenIn: Token, pools: LiquidityPool[]): [bigint, bigint] {
  let Ea: bigint = 0n;
  let Eb: bigint = 0n;
  let idx = 0;
  let tokenOut = structuredClone(tokenIn);
  for (const pool of pools) {
    if (idx === 0) {
      if (tokenIn === pool.assetA) {
        tokenOut = pool.assetB;
      } else {
        tokenOut = pool.assetA;
      }
    }
    if (idx === 1) {
      let Ra = adjustReserve(pools[0].assetA, pools[0].reserveA);
      let Rb = adjustReserve(pools[0].assetB, pools[0].reserveB);
      if (tokenIn === pools[0].assetB) {
        [Ra, Rb] = [Rb, Ra];
      }
      let Rb1 = adjustReserve(pool.assetA, pool.reserveA);
      let Rc = adjustReserve(pool.assetB, pool.reserveB);
      if (tokenOut === pool.assetB) {
        [Rb1, Rc] = [Rc, Rb1];
        tokenOut = pool.assetA;
      } else {
        tokenOut = pool.assetB;
      }
      Ea = (1000n * Ra * Rb1) / (1000n * Rb1 + 997n * Rb);
      Eb = (997n * Rb * Rc) / (1000n * Rb1 + 997n * Rb);
    }
    if (idx > 1) {
      const Ra: bigint = Ea;
      const Rb: bigint = Eb;
      let Rb1 = adjustReserve(pool.assetA, pool.reserveA);
      let Rc = adjustReserve(pool.assetB, pool.reserveB);
      if (tokenOut === pool.assetB) {
        [Rb1, Rc] = [Rc, Rb1];
        tokenOut = pool.assetA;
      } else {
        tokenOut = pool.assetB;
      }
      Ea = (1000n * Ra * Rb1) / (1000n * Rb1 + 997n * Rb);
      Eb = (997n * Rb * Rc) / (1000n * Rb1 + 997n * Rb);
    }
    idx += 1;
  }
  return [Ea, Eb];
}

function getOptimalAmount(Ea: bigint, Eb: bigint): number | undefined {
  if (Ea > Eb) {
    return undefined;
  }
  // Ensure Ea and Eb are numbers
  let Ea1 = Number(Ea);
  let Eb1 = Number(Eb);
  return Math.floor((Math.sqrt(Ea1 * Eb1 * 997 * 1000) - Ea1 * 1000) / 997);
}

function getAmountOut(
  amountIn: number,
  reserveIn: bigint,
  reserveOut: bigint
): number {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) {
    throw new Error(
      "amountIn, reserveIn, and reserveOut must be greater than 0"
    );
  }
  // Ensure amountIn, reserveIn and reserveOut are numbers
  let amountIn1 = BigInt(amountIn);
  return Number(
    (997n * amountIn1 * reserveOut) / (1000n * reserveIn + 997n * amountIn1)
  );
}

index();
