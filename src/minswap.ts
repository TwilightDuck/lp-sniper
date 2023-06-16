import { TxAlonzo, TxOut } from "@cardano-ogmios/schema";
import { AddressPlutusData, Min } from "./constants.js";
import { Constr, Assets, Lucid, TxComplete, Data, Unit } from "lucid-cardano";
import STAKE_ORDER_ADDRESS = Min.STAKE_ORDER_ADDRESS;
import { BlockfrostAdapter, NetworkId } from "@minswap/blockfrost-adapter";

const CREATE_POOL_HASH =
  "3f7eb8e720d6384bef1d469229857d694707dd1804aabd649e2a8bdc9846f032";

export function isMinswapPool(tx: TxAlonzo): false | TxOut {
  if (tx.metadata?.hash !== CREATE_POOL_HASH) {
    return false;
  }

  const output = tx.body.outputs
    .filter((tx: TxOut) => tx.value.assets === undefined ? false : Object.keys(tx.value.assets).length === 3) // Check if the output contains exactly 3 assets.
    .filter((tx: TxOut) => tx.value.coins >= 5_000_000_000n) // Check if the ADA value of this output is atleast 5,000 ADA.
    .filter((tx: TxOut) => {
      if (tx.value.assets === undefined) {
        return false;
      }
      return Object.keys(tx.value.assets)
        .map((asset: String) => asset.split(".").shift())
        .some((policyId) => policyId === Min.LP_NFT_POLICY_ID); // Check if any asset in the output contains a Minswap LP NFT.
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

  async buildExactInOrder(
    assetIn: Assets,
    assetOut: Assets,
    minimumAmountOut: bigint
  ): Promise<TxComplete> {
    assetIn["lovelace"] =
      (assetIn["lovelace"] || 0n) + Min.OUTPUT_ADA + Min.BATCHER_FEE;

    let datum = await this.buildSwapDatum(assetOut, minimumAmountOut);

    return await this.lucid
      .newTx()
      .payToContract(STAKE_ORDER_ADDRESS, Data.to(datum), assetIn)
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

    let datum = await this.buildSwapDatum(orderAssets, minLovelace);

    return await this.lucid
      .newTx()
      .payToContract(STAKE_ORDER_ADDRESS, Data.to(datum), orderAssets)
      .attachMetadata(674, { msg: [Min.MetadataMessage.SWAP_EXACT_IN_ORDER] })
      .complete();
  }

  private async buildSwapDatum(asset: Assets, minAmount: bigint) {
    let policyid = "";
    let assetname = "";

    if (!asset["lovelace"]) {
      policyid = Object.keys(asset)[0].slice(0, 56);
      assetname = Object.keys(asset)[0].slice(56);
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
      projectId: process.env.BLOCKFROST_KEY || '',
      networkId: NetworkId.MAINNET,
    });

    const MIN_ADA_POOL_ID =
      "6aa2153e1ae896a95539c9d62f76cedcdabdcdf144e564b8955f609d660cf6a2";
    for (let i = 1; ; i++) {
      const pools = await api.getPools({
        page: i,
        poolAddress: MIN_ADA_POOL_ID,
      });
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

    return 0n;
  }
}
