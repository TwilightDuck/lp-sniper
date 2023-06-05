import { Blockfrost, } from "lucid-cardano";
export class OgmiosProvider {
    submissionClient;
    stateClient;
    utxoCache = null;
    constructor(submissionClient, stateClient) {
        this.submissionClient = submissionClient;
        this.stateClient = stateClient;
    }
    awaitTx(txHash, checkInterval) {
        let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
        return blockfrost.awaitTx(txHash, checkInterval);
    }
    getDatum(datumHash) {
        let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
        return blockfrost.getDatum(datumHash);
    }
    getDelegation(rewardAddress) {
        let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
        return blockfrost.getDelegation(rewardAddress);
    }
    async getProtocolParameters() {
        return {
            minFeeA: 44,
            minFeeB: 155381,
            maxTxSize: 16384,
            maxValSize: 5000,
            keyDeposit: 2000000n,
            poolDeposit: 500000000n,
            priceMem: 0.0577,
            priceStep: 0.0000721,
            maxTxExMem: 14000000n,
            maxTxExSteps: 10000000000n,
            coinsPerUtxoByte: 4310n,
            collateralPercentage: 150,
            maxCollateralInputs: 3,
            costModels: {
                PlutusV1: {
                    "addInteger-cpu-arguments-intercept": 205665,
                    "addInteger-cpu-arguments-slope": 812,
                },
                PlutusV2: {
                    "addInteger-cpu-arguments-intercept": 205665,
                    "addInteger-cpu-arguments-slope": 812,
                },
            },
        };
    }
    getUtxoByUnit(unit) {
        let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
        return blockfrost.getUtxoByUnit(unit);
    }
    async getUtxos(addressOrCredential) {
        let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
        return await blockfrost.getUtxos(addressOrCredential);
    }
    getUtxosByOutRef(outRefs) {
        let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
        return blockfrost.getUtxosByOutRef(outRefs);
    }
    getUtxosWithUnit(addressOrCredential, unit) {
        let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
        return blockfrost.getUtxosWithUnit(addressOrCredential, unit);
    }
    async submitTx(tx) {
        try {
            return await this.submissionClient.submitTx(tx);
        }
        catch (error) {
            try {
                let blockfrost = new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", process.env.BLOCKFROST_KEY);
                return blockfrost.submitTx(tx);
            }
            catch (error) {
                throw new Error("Unable to submit");
            }
        }
    }
    async blockfrostUtxosToUtxos(result) {
        return await Promise.all(result.map(async (r) => ({
            txHash: r.tx_hash,
            outputIndex: r.output_index,
            assets: Object.fromEntries(r?.amount?.map(({ unit, quantity }) => [unit, BigInt(quantity)]) || []),
            address: r.address,
            datumHash: undefined,
            datum: undefined,
            scriptRef: undefined,
        })));
    }
}
