import { TxAlonzo, TxOut } from "@cardano-ogmios/schema";
import { AddressPlutusData, Min } from "./constants.js";
import { Constr, Assets, Lucid, TxComplete, Data } from "lucid-cardano";
import STAKE_ORDER_ADDRESS = Min.STAKE_ORDER_ADDRESS;
import { BlockfrostAdapter, NetworkId } from "@minswap/blockfrost-adapter";

const CREATE_POOL_HASH =
  "3f7eb8e720d6384bef1d469229857d694707dd1804aabd649e2a8bdc9846f032";

export function isMinswapPool(tx: TxAlonzo): false | TxOut {

  if (tx.metadata?.hash !== CREATE_POOL_HASH) {
    return false;
  }

  const output = tx.body.outputs
    .filter((tx: TxOut) => Object.keys(tx.value.assets).length === 3) // Check if the output contains exactly 3 assets.
    .filter((tx: TxOut) => tx.value.coins >= 5_000_000_000n) // Check if the ADA value of this output is atleast 5,000 ADA.
    .filter((tx: TxOut) => {
      return Object.keys(tx.value.assets)
        .map((asset: String) => asset.split(".").shift())
        .some((policyId: String) => policyId === Min.LP_NFT_POLICY_ID); // Check if any asset in the output contains a Minswap LP NFT.
    })
    .shift(); // Take the first element. If array is empty, undefined is returned.

  if (output === undefined) {
    //    Pool creation didn't match all criteria above.
    //    logger.info(`Pool didn't match our criteria.`);
    return false;
  }


  return output;
}



export class Minswap {
  lucid: Lucid;

  constructor(lucid: Lucid) {
    this.lucid = lucid;
  }

  async buildExactInOrder(options): Promise<TxComplete> {
    const { assetIn, assetOut, minimumAmountOut } = options;
    const orderAssets: Assets = { [assetIn.unit]: assetIn.quantity };
    orderAssets["lovelace"] =
      (orderAssets["lovelace"] || 0n) + Min.OUTPUT_ADA + Min.BATCHER_FEE;

    let datum = await this.buildSwapDatum(assetOut, minimumAmountOut);

    return await this.lucid
      .newTx()
      .payToContract(STAKE_ORDER_ADDRESS, Data.to(datum), orderAssets)
      .attachMetadata(674, { msg: [Min.MetadataMessage.SWAP_EXACT_IN_ORDER] })
      .complete();
  }

  async buildSellOrder(
    unit: string,
    quantity: bigint,
    minLovelace: bigint
  ): Promise<TxComplete> {
    const orderAssets: Assets = { [unit]: quantity };
    orderAssets["lovelace"] =
      (orderAssets["lovelace"] || 0n) + Min.OUTPUT_ADA + Min.BATCHER_FEE;

    let datum = await this.buildSwapDatum("lovelace", minLovelace);

    return await this.lucid
      .newTx()
      .payToContract(STAKE_ORDER_ADDRESS, Data.to(datum), orderAssets)
      .attachMetadata(674, { msg: [Min.MetadataMessage.SWAP_EXACT_IN_ORDER] })
      .complete();
  }

  private async buildSwapDatum(asset, minAmount: bigint) {
    let policyid = "";
    let assetname = "";

    if (asset !== "lovelace") {
      policyid = asset.slice(0, 56);
      assetname = asset.slice(56);
    }

    return new Constr(0, [
      AddressPlutusData.toPlutusData(await this.lucid.wallet.address()),
      AddressPlutusData.toPlutusData(await this.lucid.wallet.address()),
      new Constr(1, []),
      new Constr(Min.StepType.SWAP_EXACT_IN, [
        new Constr(0, [policyid, assetname]),
        minAmount,
      ]),
      Min.BATCHER_FEE,
      Min.OUTPUT_ADA,
    ]);
  }

  async getPrice(asset: string): Promise<BigInt> {
    const api = new BlockfrostAdapter({
      projectId: process.env.BLOCKFROST_KEY,
      networkId: NetworkId.MAINNET,
    });
    for (let i = 1; ; i++) {
      const pools = await api.getPools({ page: i });
      if (pools.length === 0) {
        break;
      }

      const minADAPool = pools.find(
        (p) => p.assetA === "lovelace" && p.assetB === asset
      );

      if (minADAPool) {
        const [a, b] = await api.getPoolPrice({ pool: minADAPool });
        return a;
      }
    }
  }
}
