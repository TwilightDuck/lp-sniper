import { Lucid } from "lucid-cardano";
import { Ogmios } from "./ogmios.js";
import { OgmiosProvider } from "./ogmiosProvider.js";
import { Sundaeswap } from "./sundaeswap.js";
import * as dotenv from "dotenv";

dotenv.config();

let ogmios = new Ogmios();
await ogmios.setupOgmios();

const lucid: Lucid = await Lucid.new(
  new OgmiosProvider(ogmios.submissionClient, ogmios.stateClient),
  "Mainnet"
);


//const seedPhrase = process.env.SEED_PHRASE;
//lucid.selectWalletFromSeed(seedPhrase);

const sundae = new Sundaeswap(lucid);
sundae.buildExactInOrder("279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f.534e454b")