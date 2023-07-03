import { PoolState } from "@minswap/blockfrost-adapter";
import { IAsset, IPoolData, IPoolDataAsset } from "@sundaeswap/sdk-core";
import { Min, decimals } from "./constants";

export class Pool {
    quantityADA: bigint;
    quantityB: bigint;
    id: string;
    fee: string | bigint;
    asset: IPoolDataAsset;
    parent: PoolState | IPoolData


    static fromMinswap(minswapPool: PoolState): Pool {
        let pool = new Pool();

        pool.quantityADA = minswapPool.reserveA;
        pool.quantityB = minswapPool.reserveB;

        const assetId = minswapPool.assetB.substring(0, 56) + '.' + minswapPool.assetB.substring(56)

        pool.asset = {
            assetId: assetId,
            decimals: decimals[assetId] ?? 6
        };

        pool.id = minswapPool.id;
        pool.fee = Min.BATCHER_FEE;
        pool.parent = minswapPool;
        return pool;
    }

    static fromSundaeswap(sundaePool: IPoolData): Pool {
        let pool = new Pool();

        pool.quantityADA = BigInt(sundaePool.quantityA);
        pool.quantityB = BigInt(sundaePool.quantityB);

        pool.asset = { assetId: sundaePool.assetB.assetId, decimals: sundaePool.assetB.decimals };

        pool.id = sundaePool.ident;
        pool.fee = sundaePool.fee;

        pool.parent = sundaePool;

        return pool;
    }

    public getPrice(): number {
        let decimals = Math.max(1, 10 ** (6 - this.asset.decimals));
        return Number(this.quantityADA * 1_000_000n / this.quantityB) / 1_000_000 / decimals;
    }



}