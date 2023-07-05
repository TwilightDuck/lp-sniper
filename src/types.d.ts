export interface Token {
    readonly ticker: string;
    readonly asset: string;
    readonly policyid: string;
    readonly unit: string;
    readonly decimals: number;
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