import {
  Address,
  Blockfrost,
  Datum,
  DatumHash,
  Delegation,
  OutRef,
  ProtocolParameters,
  Provider,
  RewardAddress,
  Transaction,
  TxHash,
  Unit,
  UTxO,
} from "lucid-cardano";
import { TxSubmissionClient } from "@cardano-ogmios/client/dist/TxSubmission/index.js";
import { StateQueryClient } from "@cardano-ogmios/client/dist/StateQuery/index.js";

export class OgmiosProvider implements Provider {
  submissionClient: TxSubmissionClient;
  stateClient: StateQueryClient;
  utxoCache: any = null;

  constructor(
    submissionClient: TxSubmissionClient,
    stateClient: StateQueryClient
  ) {
    this.submissionClient = submissionClient;
    this.stateClient = stateClient;
  }

  awaitTx(txHash: TxHash, checkInterval?: number): Promise<boolean> {
    let blockfrost = new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    );

    return blockfrost.awaitTx(txHash, checkInterval);
  }

  getDatum(datumHash: DatumHash): Promise<Datum> {
    let blockfrost = new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    );

    return blockfrost.getDatum(datumHash);
  }

  getDelegation(rewardAddress: RewardAddress): Promise<Delegation> {
    let blockfrost = new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    );

    return blockfrost.getDelegation(rewardAddress);
  }

  async getProtocolParameters(): Promise<ProtocolParameters> {
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

  getUtxoByUnit(unit: Unit): Promise<UTxO> {
    let blockfrost = new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    );

    return blockfrost.getUtxoByUnit(unit);
  }

  async getUtxos(addressOrCredential: Address): Promise<UTxO[]> {
    let blockfrost = new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    );

    return await blockfrost.getUtxos(addressOrCredential);
  }

  getUtxosByOutRef(outRefs: Array<OutRef>): Promise<UTxO[]> {
    let blockfrost = new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    );

    return blockfrost.getUtxosByOutRef(outRefs);
  }

  getUtxosWithUnit(addressOrCredential: Address, unit: Unit): Promise<UTxO[]> {
    let blockfrost = new Blockfrost(
      "https://cardano-mainnet.blockfrost.io/api/v0",
      process.env.BLOCKFROST_KEY
    );

    return blockfrost.getUtxosWithUnit(addressOrCredential as Address, unit);
  }

  async submitTx(tx: Transaction): Promise<TxHash> {
    try {
      return await this.submissionClient.submitTx(tx);
    } catch (error) {
      try {
        let blockfrost = new Blockfrost(
          "https://cardano-mainnet.blockfrost.io/api/v0",
          process.env.BLOCKFROST_KEY
        );

        return blockfrost.submitTx(tx);
      } catch (error) {
        throw new Error("Unable to submit");
      }
    }
  }
}
