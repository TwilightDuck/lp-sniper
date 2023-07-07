import { PoolState } from "@minswap/blockfrost-adapter";
import { IPoolData } from "@sundaeswap/sdk-core";
import { Min } from "./constants";
import Big from "big.js";
import { Asset, Token } from "./types";

export class Pool {
  reserveA: Big;
  reserveB: Big;
  tokenA: Token;
  tokenB: Token;
  id: string;
  fee: string | bigint;
  dex: string;

  static fromMinswap(
    minswapPool: PoolState,
    tokens: Asset[]
  ): Pool | undefined {
    let pool = new Pool();

    pool.reserveA = new Big(minswapPool.reserveA.toString());
    pool.reserveB = new Big(minswapPool.reserveB.toString());

    const tokenA = tokens.find((t: Asset) => t.id() == minswapPool.assetA);
    const tokenB = tokens.find((t: Asset) => t.id() == minswapPool.assetB);

    if (tokenA == undefined || tokenB == undefined) {
      return undefined;
    }

    pool.tokenA = tokenA;
    pool.tokenB = tokenB;

    pool.id = minswapPool.id;
    pool.fee = Min.BATCHER_FEE;
    pool.dex = "Minswap";
    return pool;
  }

  static fromSundaeswap(
    sundaePool: IPoolData,
    tokens: Asset[]
  ): Pool | undefined {
    let pool = new Pool();

    pool.reserveA = new Big(sundaePool.quantityA);
    pool.reserveB = new Big(sundaePool.quantityB);

    let tokenA: Token | undefined, tokenB: Token | undefined;

    if (sundaePool.assetA.assetId == "") {
      tokenA = "lovelace";
    } else {
      tokenA = tokens.find(
        (t: Asset) => t.id(".") === sundaePool.assetA.assetId
      );
    }

    if (sundaePool.assetB.assetId == "") {
      tokenB = "lovelace";
    } else {
      tokenB = tokens.find(
        (t: Asset) => t.id(".") === sundaePool.assetB.assetId
      );
    }

    if (tokenA == undefined || tokenB == undefined) {
      return undefined;
    }

    pool.tokenA = tokenA;
    pool.tokenB = tokenB;

    pool.id = sundaePool.ident;
    pool.fee = sundaePool.fee;

    pool.dex = "Sundaeswap";

    return pool;
  }

  get price(): number {
    const tokenADecimals: number =
      this.tokenA === "lovelace" ? 6 : this.tokenA.decimals;
    const tokenBDecimals: number =
      this.tokenB === "lovelace" ? 6 : this.tokenB.decimals;

    const adjustedReserveA: number =
      Number(this.reserveA) / 10 ** tokenADecimals;
    const adjustedReserveB: number =
      Number(this.reserveB) / 10 ** tokenBDecimals;

    return adjustedReserveA / adjustedReserveB;
  }

  get totalValueLocked(): number {
    const tokenADecimals: number =
      this.tokenA === "lovelace" ? 6 : this.tokenA.decimals;
    const tokenBDecimals: number =
      this.tokenB === "lovelace" ? 6 : this.tokenB.decimals;

    if (this.tokenA === "lovelace") {
      return (
        Number(this.reserveA) / 10 ** tokenADecimals +
        (Number(this.reserveB) / 10 ** tokenBDecimals) * this.price
      );
    }

    return (
      (Number(this.reserveA) / 10 ** tokenADecimals) *
      this.price *
      ((Number(this.reserveB) / 10 ** tokenBDecimals) * (1 / this.price))
    );
  }
}
