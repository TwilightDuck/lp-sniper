import { TxAlonzo, TxOut } from "@cardano-ogmios/schema";
import { Constr, Assets, Lucid, TxComplete, Data, UTxO, Tx } from "lucid-cardano";
import { Sundae } from "./constants.js";
import { Transaction, TxBuilder } from "@sundaeswap/sdk-core";

const CREATE_POOL_HASH =
  "d2a93d4de0bcd8309793e832f98a843d23639cb19d9ed3d73d503ac267dcf88d";

export function isSundaeswapPool(tx: TxAlonzo): false | { output: TxOut, poolId: string } {

  if (tx.metadata?.hash !== CREATE_POOL_HASH) {
    return false;
  }

  const output = tx.body.outputs
    .filter((tx: TxOut) => Object.keys(tx.value.assets).length === 2)
    // .filter((tx: TxOut) => tx.value.coins >= 5_000_000_000n) // Check if the ADA value of this output is atleast 5,000 ADA.
    .filter((tx: TxOut) => {
      return Object.keys(tx.value.assets)
        .map((asset: String) => asset.split(".").shift())
        .some((policyId: String) => policyId === Sundae.LP_NFT_POLICY_ID);
    })
    .shift(); // Take the first element. If array is empty, undefined is returned.

  if (output === undefined) {
    //    Pool creation didn't match all criteria above.
    //    logger.info(`Pool didn't match our criteria.`);
    return false;
  }


  const poolId = Object.keys(output.value.assets)
    .map((asset: String) => asset.split(".").shift())
    .find((policyId: String) => policyId === Sundae.LP_NFT_POLICY_ID);

  return { output, poolId };
}

export class Sundaeswap {
  lucid: Lucid;

  constructor(lucid: Lucid) {
    this.lucid = lucid;
  }

  async buildExactInOrder(ident, assetA, assetB, orderAddresses, suppliedAsset, minReceivable,) {


    const datumBuilder = new DatumBuilderLucid("mainnet");
    const { cbor } = datumBuilder.buildSwapDatum({
      ident,
      swap: {
        SuppliedCoin: this.getAssetSwapDirection(suppliedAsset, [
          assetA,
          assetB,
        ]),
        MinimumReceivable: minReceivable,
      },
      orderAddresses,
      fundedAsset: suppliedAsset,
    });


    const orderAssets: Assets = { [suppliedAsset.unit]: suppliedAsset.quantity };
    orderAssets["lovelace"] = (orderAssets["lovelace"] || 0n) + Sundae.SCOOPER_FEE + Sundae.RIDER_FEE;

    return await this.lucid
      .newTx()
      .payToContract(Sundae.ESCROW_ADDRESS, Data.to(cbor), orderAssets)
      .complete();
  }

  getAssetSwapDirection({ assetId: assetID }, assets) {
    const sorted = assets.sort((a, b) => a.assetId.localeCompare(b.assetId));
    if (sorted[1]?.assetId === assetID) {
      return 1;
    }

    return 0;
  }
}
