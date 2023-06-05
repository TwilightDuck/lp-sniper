import * as dotenv from "dotenv";
import { Min } from "./constants.js";
import { Lucid } from "lucid-cardano";
import * as process from "process";
import { OgmiosProvider } from "./ogmiosProvider.js";
import { Ogmios } from "./ogmios.js";
import { Minswap } from "./minswap.js";
import winston, { createLogger, format } from "winston";
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
            .filter((tx) => !recentTxs.includes(tx.id))
            .forEach((tx) => {
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
async function processTransaction(tx) {
    const output = tx.body.outputs
        .filter((tx) => Object.keys(tx.value.assets).length === 3) // Check if the output contains exactly 3 assets.
        .filter((tx) => tx.value.coins >= 5000000000n) // Check if the ADA value of this output is atleast 5,000 ADA.
        .filter((tx) => {
        return Object.keys(tx.value.assets)
            .map((asset) => asset.split(".").shift())
            .some((policyId) => policyId === Min.LP_NFT_POLICY_ID); // Check if any asset in the output contains a Minswap LP NFT.
    })
        .shift(); // Take the first element. If array is empty, undefined is returned.
    if (output === undefined) {
        //    Pool creation didn't match all criteria above.
        //    logger.info(`Pool didn't match our criteria.`);
        return;
    }
    logger.info(`found a pool`);
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
    if (asset.slice(56) === "5350494359" &&
        output.value.coins > 300000000000n) {
        sendMinswapSwapTx(1000000n, asset).then((txHash) => {
            recentPurchases.push(asset);
        });
        logger.info(`Buying ${asset} with an input of ${(20000000000n / 1000000n).toLocaleString()}`);
    }
}
export async function sendMinswapSwapTx(amount, asset) {
    const lucid = await Lucid.new(new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient), "Mainnet");
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
main();
