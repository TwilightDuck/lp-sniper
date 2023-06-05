import { AddressPlutusData, Min } from "./constants.js";
import { Constr, Data } from "lucid-cardano";
var STAKE_ORDER_ADDRESS = Min.STAKE_ORDER_ADDRESS;
import { BlockfrostAdapter, NetworkId } from "@minswap/blockfrost-adapter";
const CREATE_POOL_HASH = "3f7eb8e720d6384bef1d469229857d694707dd1804aabd649e2a8bdc9846f032";
export function isMinswapPool(tx) {
    return tx.metadata?.hash === CREATE_POOL_HASH;
}
export class Minswap {
    lucid;
    constructor(lucid) {
        this.lucid = lucid;
    }
    async buildExactInOrder(options) {
        const { assetIn, assetOut, minimumAmountOut } = options;
        const orderAssets = { [assetIn.unit]: assetIn.quantity };
        orderAssets["lovelace"] =
            (orderAssets["lovelace"] || 0n) + Min.OUTPUT_ADA + Min.BATCHER_FEE;
        let datum = await this.buildSwapDatum(assetOut, minimumAmountOut);
        return await this.lucid
            .newTx()
            .payToContract(STAKE_ORDER_ADDRESS, Data.to(datum), orderAssets)
            .attachMetadata(674, { msg: [Min.MetadataMessage.SWAP_EXACT_IN_ORDER] })
            .complete();
    }
    async buildSellOrder(unit, quantity, minLovelace) {
        const orderAssets = { [unit]: quantity };
        orderAssets["lovelace"] =
            (orderAssets["lovelace"] || 0n) + Min.OUTPUT_ADA + Min.BATCHER_FEE;
        let datum = await this.buildSwapDatum("lovelace", minLovelace);
        return await this.lucid
            .newTx()
            .payToContract(STAKE_ORDER_ADDRESS, Data.to(datum), orderAssets)
            .attachMetadata(674, { msg: [Min.MetadataMessage.SWAP_EXACT_IN_ORDER] })
            .complete();
    }
    async buildSwapDatum(asset, minAmount) {
        let policyid = "";
        let assetname = "";
        if (asset !== "lovelace") {
            policyid = asset.slice(0, 56);
            assetname = asset.slice(56);
        }
        return new Constr(0, [
            AddressPlutusData.toPlutusData(await this.lucid.wallet.address()),
            AddressPlutusData.toPlutusData(await this.lucid.wallet.address()),
            new Constr(1, []),
            new Constr(Min.StepType.SWAP_EXACT_IN, [
                new Constr(0, [policyid, assetname]),
                minAmount,
            ]),
            Min.BATCHER_FEE,
            Min.OUTPUT_ADA,
        ]);
    }
    async getPrice(asset) {
        const api = new BlockfrostAdapter({
            projectId: process.env.BLOCKFROST_KEY,
            networkId: NetworkId.MAINNET,
        });
        for (let i = 1;; i++) {
            const pools = await api.getPools({ page: i });
            if (pools.length === 0) {
                break;
            }
            const minADAPool = pools.find((p) => p.assetA === "lovelace" && p.assetB === asset);
            if (minADAPool) {
                const [a, b] = await api.getPoolPrice({ pool: minADAPool });
                return a;
            }
        }
    }
}
