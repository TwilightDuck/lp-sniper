import { TxAlonzo, TxOut } from "@cardano-ogmios/schema";
import { Sundae } from "./constants.js";
import { OrderAddresses, } from "@sundaeswap/sdk-core";
import { Assets, C, Constr, Data, Lucid, getAddressDetails, } from "lucid-cardano";

const CREATE_POOL_HASH = "d2a93d4de0bcd8309793e832f98a843d23639cb19d9ed3d73d503ac267dcf88d";

export function isSundaeswapPool(tx: TxAlonzo): false | { output: TxOut; poolId: string } {
  if (tx.metadata?.hash !== CREATE_POOL_HASH) {
    return false;
  }

  const output = tx.body.outputs
    .filter((tx: TxOut) => Object.keys(tx.value.assets).length === 2)
    .filter((tx: TxOut) => tx.value.coins >= 5_000_000_000n) // Check if the ADA value of this output is atleast 5,000 ADA.
    .filter((tx: TxOut) => {
      return Object.keys(tx.value.assets)
        .map((asset: String) => asset.split(".").shift())
        .some((policyId: String) => policyId === Sundae.LP_NFT_POLICY_ID);
    })
    .shift(); // Take the first element. If array is empty, undefined is returned.

  if (output === undefined) {
    //    Pool creation didn't match all criteria above.
    //  logger.info(`Pool didn't match our criteria.`);
    return false;
  }

  const poolId = Object.keys(output.value.assets)
    .filter((asset: String) => asset.split(".").shift() === Sundae.LP_NFT_POLICY_ID)
    .shift()
    .split(".")
    .pop()
    .substring(4);
    

  return { output, poolId };
}

export class Sundaeswap {
  lucid: Lucid;

  constructor(lucid: Lucid) {
    this.lucid = lucid;
  }

  async buildExactInOrder(
    ident,
    orderAddresses: OrderAddresses,
    amount: bigint
  ) {
    const datum = new Constr(0, [
      ident,
      this.buildOrderAddresses(orderAddresses).datum,
      Sundae.SCOOPER_FEE,
      new Constr(0, [new Constr(0, []), amount, new Constr(0, [1n])]),
    ]);

    const orderAssets: Assets = { ["lovelace"]: amount };
    orderAssets["lovelace"] = (orderAssets["lovelace"] || 0n) + Sundae.SCOOPER_FEE + Sundae.RIDER_FEE;

    return await this.lucid
      .newTx()
      .payToContract(Sundae.ESCROW_ADDRESS, Data.to(datum), orderAssets)
      .attachMetadata(674, { msg: ["SSP: Swap Request"] })
      .complete();
  }

  getAssetSwapDirection({ assetId: assetID }, assets) {
    const sorted = assets.sort((a, b) => a.assetId.localeCompare(b.assetId));
    if (sorted[1]?.assetId === assetID) {
      return 1;
    }

    return 0;
  }

  buildOrderAddresses(addresses: OrderAddresses) {
    const { DestinationAddress, AlternateAddress } = addresses;
    const destination = getAddressDetails(DestinationAddress.address);

    const destinationDatum = new Constr(0, [
      new Constr(0, [
        new Constr(0, [destination.paymentCredential.hash,]),
        destination?.stakeCredential.hash
          ? new Constr(0, [
            new Constr(0, [
              new Constr(0, [destination?.stakeCredential.hash]),
            ]),
          ])
          : new Constr(1, []),
      ]),
      DestinationAddress?.datumHash
        ? new Constr(0, [DestinationAddress.datumHash])
        : new Constr(1, []),
    ]);

    const alternate = AlternateAddress && getAddressDetails(AlternateAddress);
    const alternateDatum = new Constr(
      alternate ? 0 : 1,
      alternate ? [alternate.paymentCredential.hash] : []
    );

    const datum = new Constr(0, [destinationDatum, alternateDatum]);

    return {
      cbor: Data.to(datum),
      hash: C.hash_plutus_data(
        C.PlutusData.from_bytes(Buffer.from(Data.to(datum), "hex"))
      )?.to_hex(),
      datum,
    };
  }
}
