import { LiquidityPool } from "@indigo-labs/dexter";
import Big from "big.js";

export class Asset {
  public policyId: string;
  public nameHex: string;
  public decimals: number;

  constructor(policyId: string, assetNameHex: string, decimals: number = 0) {
    this.policyId = policyId;
    this.nameHex = assetNameHex;
    this.decimals = decimals;
  }

  static fromId(id: string, decimals: number = 0): Asset {
    id = id.replace(".", "");

    return new Asset(id.slice(0, 56), id.slice(56), decimals);
  }

  id(dilimeter: "" | "." = ""): string {
    return this.policyId + dilimeter + this.nameHex;
  }

  get assetName(): string {
    return Buffer.from(this.nameHex, "hex").toString();
  }
}

export type Token = Asset | "lovelace";

export interface CexplorerToken {
  readonly fingerprint: string;
  readonly policy: string;
  readonly name_small: string;
  readonly quantity: Big;
  readonly name: string;
  readonly registry_decimal: number;
  readonly registry_name: string;
  readonly registry_ticker: string;
  readonly verified: boolean;
  readonly price_ada: Big;
  readonly volume_daily: Big;
  readonly url: string;
}

export interface Pair {
  readonly dex: string;
  readonly token0: string;
  readonly token1: Token;
}

/** Represents a pair of AMM pairs to perform arbitrage on for a pair of baseToken & quoteToken */
export interface ArbitragePair {
  readonly baseToken: string;
  readonly quoteToken: Token;
  readonly pair0: Pair;
  readonly pair1: Pair;
}

export type Circle = {
  route: LiquidityPool[];
  path: Token[];
};

export type Trade = {
  route: LiquidityPool[];
  path: Token[];
  Ea: bigint;
  Eb: bigint;
  optimalAmount?: number;
  outputAmount?: number;
  profit?: number;
  p?: number;
};
