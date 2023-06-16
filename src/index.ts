import * as dotenv from "dotenv";
import { TxAlonzo, TxOut } from "@cardano-ogmios/schema";
import { Min } from "./constants.js";

import { Assets, Lucid, TxHash } from "lucid-cardano";
import * as process from "process";
import { OgmiosProvider } from "./ogmiosProvider.js";
import { Ogmios } from "./ogmios.js";
import { isMinswapPool, Minswap } from "./minswap.js";
import winston, { createLogger, format } from "winston";
import { Sundaeswap, isSundaeswapPool } from "./sundaeswap.js";
import pkg from "twilio";

const { Twilio } = pkg;

let recentTxs: Array<TxHash> = [];
let recentPurchases: Array<string> = [];
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
  let minswapOut = isMinswapPool(tx);

  if (minswapOut) {
    processMinswap(minswapOut);
    return;
  }

  let sundaeOut = isSundaeswapPool(tx);

  if (sundaeOut) {
    let { output, poolId } = sundaeOut;
    logger.info(`Found SundaeSwap pool with ID: ${poolId}`);
    processSundaeswap(output, poolId);
    return;
  }
}

async function processSundaeswap(output: TxOut, poolId: string) {
  const assets = output.value.assets;

  if (assets === undefined) {
    return;
  }

  //  Get the asset of the new token.
  let value = Object.values(assets)
    .filter((v) => v > 1n)
    .shift();


  const asset = Object.keys(assets)
    .find((key: string) => assets[key] === value)
    ?.replace(".", "");

  if (asset === undefined) {
    return;
  }


  //  Check if we've already purchased this token before.
  if (recentPurchases.includes(asset)) {
    logger.info(`Skipping ${asset} because we've already bought it before.`);
    return;
  }

  sendSundaeSwapTx(determinePurchaseAmount(output), poolId).then(
    (txHash: TxHash | null) => {
      recentPurchases.push(asset);
    }
  );

  logger.info(
    `Buying ${asset} with an input of ${determinePurchaseAmount(output)}`
  );
}

async function processMinswap(output: TxOut) {
  const assets = output.value.assets;


  if (assets === undefined) {
    return;
  }

  //  Get the asset of the new token.
  let value = Object.values(assets)
    .filter((v) => v > 1n)
    .shift();
  let asset = Object.keys(assets)
    .find((key) => assets[key] === value)
    ?.replace(".", "");

  if (asset === undefined) {
    return;
  }

  //  Check if we've already purchased this token before.
  if (recentPurchases.includes(asset)) {
    logger.info(`Skipping ${asset} because we've already bought it before.`);
    return;
  }

  sendMinswapSwapTx(determinePurchaseAmount(output), asset).then(
    (txHash: TxHash | null) => {
      recentPurchases.push(asset || '');
    }
  );

  logger.info(
    `Buying ${asset} with an input of ${determinePurchaseAmount(output)}`
  );
}

function determinePurchaseAmount(tx: TxOut): bigint {
  if (tx.value.coins > 300_000_000_000n) {
    return (tx.value.coins * 20n) / 1000n;
  }
  if (tx.value.coins > 200_000_000_000n) {
    return (tx.value.coins * 15n) / 1000n;
  }
  if (tx.value.coins > 50_000_000_000n) {
    return (tx.value.coins * 5n) / 1000n;
  }

  return 0n;
}

async function sendMinswapSwapTx(amount: bigint, asset: string) {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE || '';
  lucid.selectWalletFromSeed(seedPhrase);
  sender: await lucid.wallet.address();
  let assetIn: Assets = { lovelace: amount };
  let assetOut: Assets = { asset: 1n };

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

  const client = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  client.messages.create({
    body: `Bought ${amount / 1_000_000n} ADA of ${asset} on Minswap`,
    from: process.env.TWILIO_PHONE,
    to: process.env.PHONE || '',
  });

  console.log(txHash);
  logger.info(`Transaction submitted: ${txHash}`);

  return txHash;
}

async function sendSundaeSwapTx(amount: bigint, poolId: string) {
  const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
  );
  const seedPhrase = process.env.SEED_PHRASE || '';
  lucid.selectWalletFromSeed(seedPhrase);

  let sundaeswap = new Sundaeswap(lucid);
  let tx = await sundaeswap.buildExactInOrder(
    poolId,
    { DestinationAddress: { address: await lucid.wallet.address() } },
    amount
  );

  const signedTx = await tx.sign().complete();

  let txHash = await signedTx.submit();

  if (txHash === null) {
    return null;
  }

  const client = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  client.messages.create({
    body: `Bought ${amount / 1_000_000n} ADA of ${poolId} on SundaeSwap`,
    from: process.env.TWILIO_PHONE,
    to: process.env.PHONE || '',
  });

  logger.info(`Transaction submitted: ${txHash}`);
  console.log(txHash);
  return txHash;
}

main();
