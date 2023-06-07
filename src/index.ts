import * as dotenv from "dotenv";
import { TxAlonzo, TxOut } from "@cardano-ogmios/schema";
import { Min } from "./constants.js";

import { Lucid, TxHash } from "lucid-cardano";
import * as process from "process";
import { OgmiosProvider } from "./ogmiosProvider.js";
import { Ogmios } from "./ogmios.js";
import { isMinswapPool, Minswap } from "./minswap.js";
import winston, { createLogger, format } from "winston";
import { Sundaeswap, isSundaeswapPool } from "./sundaeswap.js";

let recentTxs = [];
let recentPurchases = [];

let ogmios = new Ogmios();

dotenv.config();

const logger = createLogger({
  level: "verbose",
  format: format.combine(format.timestamp(), format.prettyPrint()),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "info.log", level: "info" }),
    new winston.transports.File({ filename: "verbose.log" }),
    new winston.transports.Console(),
  ],
});

async function main() {
  await ogmios.setupOgmios();
  console.log("started!");
  console.log(process.env.SEED_PHRASE);
  console.log(process.env.BLOCKFROST_KEY);
  while (true) {
    (await ogmios.fetchTransactions())
      .filter((tx: TxAlonzo) => !recentTxs.includes(tx.id))
      .forEach((tx: TxAlonzo) => {
        recentTxs.push(tx.id);
        processTransaction(tx)
          .then((result) => {
            logger.verbose(`Processed: ${tx.id}`);
          })
          .catch((result) => {
            logger.error(`Error processing: ${tx.id}`);
          });
      });

    if (recentTxs.length > 250) {
      recentTxs.splice(0, recentTxs.length - 250);
    }

    if (recentPurchases.length > 10) {
      recentPurchases.splice(0, recentPurchases.length - 10);
    }
  }
}

async function processTransaction(tx: TxAlonzo) {

  let minswapOut = isMinswapPool(tx)

  if (minswapOut) {
    processMinswap(minswapOut);
    return;
  }

  let sundaeOut = isSundaeswapPool(tx);


  if (sundaeOut) {
    let { output, poolId } = sundaeOut;
    processSundaeswap(output, poolId);
    return;
  }
}

async function processSundaeswap(output: TxOut, poolId: string) {

  const assets = output.value.assets;

  //  Get the asset of the new token.
  let value = Object.values(assets)
    .filter((v) => v > 1n)
    .shift();

  const asset = Object.keys(assets)
    .find((key) => assets[key] === value)
    .replace(".", "");

  //  Check if we've already purchased this token before.
  if (recentPurchases.includes(asset)) {
    logger.info(`Skipping ${asset} because we've already bought it before.`);
    return;
  }

  sendSundaeSwapTx(determinePurchaseAmount(output), asset, poolId).then((txHash: TxHash) => {
    recentPurchases.push(asset);
  });

  logger.info(
    `Buying ${asset} with an input of ${determinePurchaseAmount(output).toLocaleString()}`
  );


}

async function processMinswap(output: TxOut) {

  const assets = output.value.assets;

  //  Get the asset of the new token.
  let value = Object.values(assets)
    .filter((v) => v > 1n)
    .shift();
  let asset = Object.keys(assets)
    .find((key) => assets[key] === value)
    .replace(".", "");

  //  Check if we've already purchased this token before.
  if (recentPurchases.includes(asset)) {
    logger.info(`Skipping ${asset} because we've already bought it before.`);
    return;
  }

  if (
    asset.slice(56) === "5350494359" &&
    output.value.coins > 300_000_000_000n
  ) {
    sendMinswapSwapTx(determinePurchaseAmount(output), asset).then((txHash: TxHash) => {
      recentPurchases.push(asset);
    });

    logger.info(
      `Buying ${asset} with an input of ${determinePurchaseAmount(output).toLocaleString()}`
    );
  }
}

function determinePurchaseAmount(tx: TxOut): bigint {
  return tx.value.coins * 4n / 1000n;
}


async function sendMinswapSwapTx(amount: bigint, asset: string) {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE;
  lucid.selectWalletFromSeed(seedPhrase);
  const options = {
    sender: await lucid.wallet.address(),
    assetIn: {
      unit: "lovelace",
      quantity: amount,
    },
    assetOut: asset,
    minimumAmountOut: 1n,
  };

  let minswap = new Minswap(lucid);
  let tx = await minswap.buildExactInOrder(options);

  const signedTx = await tx.sign().complete();

  let txHash = await signedTx.submit();

  if (txHash === null) {
    return;
  }

  console.log(txHash);
  return txHash;
}

async function sendSundaeSwapTx(amount: bigint, asset: string, poolId: string) {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE;
  lucid.selectWalletFromSeed(seedPhrase);



  const options = {
    sender: await lucid.wallet.address(),
    assetIn: {
      unit: "lovelace",
      quantity: amount,
    },
    assetOut: asset,
    minimumAmountOut: 1n,
  };

  let sundaeswap = new Sundaeswap(lucid);
  let tx = await sundaeswap.buildExactInOrder(options);

  const signedTx = await tx.sign().complete();

  let txHash = await signedTx.submit();

  if (txHash === null) {
    return;
  }

  console.log(txHash);
  return txHash;
}
main();
