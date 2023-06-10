import { Blockfrost, Lucid, Tx, TxComplete } from "lucid-cardano";
import { OgmiosProvider } from "./ogmiosProvider.js";
import * as dotenv from "dotenv";
import { Minswap } from './minswap.js';
import db from "./db.js";
import { Ogmios } from "./ogmios.js";
import _ from 'lodash';
import { exit } from "process";
import { Min } from './constants.js';

const delay = ms => new Promise(res => setTimeout(res, ms));

dotenv.config();
let ogmios = new Ogmios();
ogmios.setupOgmios();

const lucid: Lucid = await Lucid.new(
    new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
    "Mainnet"
);
const seedPhrase = process.env.SEED_PHRASE;
lucid.selectWalletFromSeed(seedPhrase);


let asset = "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e";
let amount = 5_000_000n;

const oldUtxos = await lucid.provider.getUtxosWithUnit(await lucid.wallet.address(), asset);
const txHash = await sendMinswapSwapTx(amount, asset);
const result = await db.run(`INSERT INTO test (asset, dex, amount) VALUES (?, ?, ?)`, asset, 'minswap', parseInt(amount.toString()));

// now monitor for when the assets arrive in the wallet.

let newUTXO = []

while (newUTXO.length === 0) {
    await delay(500);
    const utxos = await lucid.provider.getUtxosWithUnit(await lucid.wallet.address(), asset);
    newUTXO = utxos.filter(function (obj) {
        return !oldUtxos.some((obj2) => obj.txHash == obj2.txHash);
    });
}

const purchase = newUTXO[0]

await db.run(`UPDATE test SET quantity = ?, price = ? WHERE id = ?`,
    purchase.assets[asset],
    purchase.assets[asset] / (amount + Min.BATCHER_FEE)
)

console.log(await db.get('SELECT * from test'));

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
    return txHash;
}

exit;