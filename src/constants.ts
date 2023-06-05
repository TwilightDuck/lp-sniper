import { Address, Constr, getAddressDetails } from "lucid-cardano";

export namespace Min {
  export const LP_NFT_POLICY_ID =
    "0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1";
  export const OUTPUT_ADA = 2_000_000n;
  export const BATCHER_FEE = 2_000_000n;

  // 0 is Testnet
  // 1 is Mainnet
  export const STAKE_ORDER_ADDRESS = "addr1zxn9efv2f6w82hagxqtn62ju4m293tqvw0uhmdl64ch8uw6j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq6s3z70";

  export enum StepType {
    SWAP_EXACT_IN = 0,
    SWAP_EXACT_OUT,
    DEPOSIT,
    WITHDRAW,
    ONE_SIDE_DEPOSIT,
  }

  export enum MetadataMessage {
    CANCEL_ORDER = "Minswap: Cancel Order",
    SWAP_EXACT_IN_ORDER = "Minswap: Swap Exact In Order",
  }
}

/** Hex */
export declare type PaymentKeyHash = string;
/** Hex */
export declare type ScriptHash = string;
/** Hex */
export declare type StakeKeyHash = string;
/** Hex */
export declare type KeyHash = string | PaymentKeyHash | StakeKeyHash;

export declare type Credential = {
  type: "Key" | "Script";
  hash: KeyHash | ScriptHash;
};
export namespace LucidCredential {
  export function toPlutusData(data: Credential) {
    const constructor = data.type === "Key" ? 0 : 1;
    return new Constr(constructor, [data.hash]);
  }
}

export namespace AddressPlutusData {
  export function toPlutusData(address: Address) {
    const addressDetails = getAddressDetails(address);
    if (addressDetails.type === "Base") {
      const stakeCredConstr = addressDetails.stakeCredential
        ? new Constr(0, [
            new Constr(0, [
              LucidCredential.toPlutusData(addressDetails.stakeCredential),
            ]),
          ])
        : new Constr(1, []);

      return new Constr(0, [
        LucidCredential.toPlutusData(addressDetails.paymentCredential),
        stakeCredConstr,
      ]);
    }
    if (addressDetails.type === "Enterprise") {
      return new Constr(0, [
        LucidCredential.toPlutusData(addressDetails.paymentCredential),
        new Constr(1, []),
      ]);
    }
    throw new Error("only supports base address, enterprise address");
  }
}
