import Big from "big.js";

export interface Token {
    readonly ticker: string;
    readonly asset: string;
    readonly policy: string;
    readonly unit: string;
    readonly decimals: number;
    readonly quantity: Big;
}

export const lovelace = <Token>{
    ticker: "lovelace",
    asset: "lovelace",
    policy: "lovelace",
    unit: "lovelace",
    decimals: 6,
    quantity: 45_000_000_000,
}

export interface CexplorerToken {
    readonly fingerprint: string,
    readonly policy: string,
    readonly name_small: string,
    readonly quantity: Big,
    readonly name: string,
    readonly registry_decimal: number,
    readonly registry_name: string,
    readonly registry_ticker: string,
    readonly verified: boolean,
    readonly price_ada: Big,
    readonly volume_daily: Big,
    readonly url: string
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
};