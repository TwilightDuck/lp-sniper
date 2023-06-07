import { Lucid, TxComplete } from "lucid-cardano";
import { Ogmios } from "./ogmios.js";
import { OgmiosProvider } from "./ogmiosProvider.js";
import { Sundaeswap } from "./sundaeswap.js";
import * as dotenv from "dotenv";
import { IAsset } from "@sundaeswap/sdk-core";
import { exit } from "process";

dotenv.config();

let ogmios = new Ogmios();
await ogmios.setupOgmios();

const lucid: Lucid = await Lucid.new(
  new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
  "Mainnet"
);

const seedPhrase = process.env.SEED_PHRASE;
lucid.selectWalletFromSeed(seedPhrase);

const sundae = new Sundaeswap(lucid);
const tx: TxComplete = await sundae.buildExactInOrder(
  "c1", // Pool ID
  { DestinationAddress: { address: await lucid.wallet.address() } },
  5_000_000n
);
const signedTx = await tx.sign().complete();

let txHash = await signedTx.submit();
console.log(txHash);

exit;
