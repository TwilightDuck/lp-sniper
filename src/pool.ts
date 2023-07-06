import { PoolState } from "@minswap/blockfrost-adapter";
import { IPoolData, IPoolDataAsset } from "@sundaeswap/sdk-core";
import { Min, decimals } from "./constants";
import Big from "big.js";
import { getQuoteTokens } from "./tokens";
import { Token, lovelace } from "./types";

export class Pool {
  reserveA: Big;
  reserveB: Big;
  tokenA: Token;
  tokenB: Token;
  id: string;
  fee: string | bigint;
  dex: string;
  parent: PoolState | IPoolData;

  static fromMinswap(minswapPool: PoolState): Pool {
    let pool = new Pool();

    pool.reserveA = new Big(minswapPool.reserveA.toString());
    pool.reserveB = new Big(minswapPool.reserveB.toString());

    pool.tokenA = minswapPool.assetA === "lovelace" ? lovelace : 

    pool.id = minswapPool.id;
    pool.fee = Min.BATCHER_FEE;
    pool.parent = minswapPool;
    pool.dex = "Minswap";
    return pool;
  }

  static fromSundaeswap(sundaePool: IPoolData): Pool {
    let pool = new Pool();

    pool.reserveA = new Big(sundaePool.quantityA);
    pool.reserveB = new Big(sundaePool.quantityB);

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
    return this.reserveA.div(this.reserveB).div(decimals).toNumber();
  }

  get assetid(): string {
    // read-only property with getter function (this is not the same thing as a “function-property”)
    return (
      this.asset.assetId.substring(0, 56) + this.asset.assetId.substring(57)
    );
  }
}
