import { PoolState } from "@minswap/blockfrost-adapter";
import { IPoolData, IPoolDataAsset } from "@sundaeswap/sdk-core";
import { Min, decimals } from "./constants";
import Big from "big.js";

export class Pool {
  reserveA: bigint;
  reserveB: bigint;
  id: string;
  fee: string | bigint;
  dex: string;
  asset: IPoolDataAsset;
  parent: PoolState | IPoolData;

  static fromMinswap(minswapPool: PoolState): Pool {
    let pool = new Pool();

    pool.reserveA = minswapPool.reserveA;
    pool.reserveB = minswapPool.reserveB;

    const assetId =
      minswapPool.assetB.substring(0, 56) +
      "." +
      minswapPool.assetB.substring(56);

    pool.asset = {
      assetId: assetId,
      decimals: decimals[assetId] ?? 6,
    };

    pool.id = minswapPool.id;
    pool.fee = Min.BATCHER_FEE;
    pool.parent = minswapPool;
    pool.dex = "Minswap";
    return pool;
  }

  static fromSundaeswap(sundaePool: IPoolData): Pool {
    let pool = new Pool();

    pool.reserveA = BigInt(sundaePool.quantityA);
    pool.reserveB = BigInt(sundaePool.quantityB);

    pool.asset = {
      assetId: sundaePool.assetB.assetId,
      decimals: sundaePool.assetB.decimals,
    };

    pool.id = sundaePool.ident;
    pool.fee = sundaePool.fee;

    pool.parent = sundaePool;
    pool.dex = "Sundaeswap";

    return pool;
  }

  public getPrice(): number {
    let decimals = Math.max(1, 10 ** (6 - this.asset.decimals));
    return (
      Number((this.reserveA * 1_000_000n) / this.reserveB) /
      1_000_000 /
      decimals
    );
  }

  get assetid(): string {
    // read-only property with getter function (this is not the same thing as a “function-property”)
    return (
      this.asset.assetId.substring(0, 56) + this.asset.assetId.substring(57)
    );
  }

  /**
   * Get the output amount if we swap a certain amount of a token in the pair
   * @param assetIn The asset that we want to swap from
   * @param amountIn The amount that we want to swap from
   * @returns The amount of the other token that we get from the swap and its price impact
   */
  private getAmountOut(
    assetIn: string,
    amountIn: bigint
  ): { amountOut: bigint; priceImpact: Big } {
    const [reserveIn, reserveOut] =
      assetIn === "lovelace"
        ? [this.reserveA, this.reserveB]
        : [this.reserveB, this.reserveA];

    const amtOutNumerator = amountIn * 997n * reserveOut;
    const amtOutDenominator = amountIn * 997n + reserveIn * 1000n;

    const priceImpactNumerator =
      reserveOut * amountIn * amtOutDenominator * 997n -
      amtOutNumerator * reserveIn * 1000n;
    const priceImpactDenominator =
      reserveOut * amountIn * amtOutDenominator * 1000n;

    return {
      amountOut: amtOutNumerator / amtOutDenominator,
      priceImpact: new Big(priceImpactNumerator.toString()).div(
        new Big(priceImpactDenominator.toString())
      ),
    };
  }

  /**
   * Get the input amount needed if we want to get a certain amount of a token in the pair from swapping
   * @param assetOut The asset that we want to get from the pair
   * @param amountOut The amount of assetOut that we want get from the swap
   * @returns The amount needed of the input token for the swap and its price impact
   */
  private getAmountIn(
    assetOut: string,
    amountOut: bigint
  ): { amountIn: bigint; priceImpact: Big } {
    const [reserveIn, reserveOut] =
      assetOut === this.asset.assetId
        ? [this.reserveA, this.reserveB]
        : [this.reserveB, this.reserveA];

    const amtInNumerator = reserveIn * amountOut * 1000n;
    const amtInDenominator = (reserveOut - amountOut) * 997n;

    const priceImpactNumerator =
      reserveOut * amtInNumerator * 997n -
      amountOut * amtInDenominator * reserveIn * 1000n;
    const priceImpactDenominator = reserveOut * amtInNumerator * 1000n;

    return {
      amountIn: amtInNumerator / amtInDenominator + 1n,
      priceImpact: new Big(priceImpactNumerator.toString()).div(
        new Big(priceImpactDenominator.toString())
      ),
    };
  }
}
