import {
  createTxMonitorClient,
  createTxSubmissionClient,
  createStateQueryClient,
  createInteractionContext,
} from "@cardano-ogmios/client";
import { TxMonitorClient } from "@cardano-ogmios/client/dist/TxMonitor/index.js";
import { TxSubmissionClient } from "@cardano-ogmios/client/dist/TxSubmission/index.js";
import { StateQueryClient } from "@cardano-ogmios/client/dist/StateQuery/index.js";
import winston, { createLogger, Logger, loggers } from "winston";
import { TxAlonzo } from "@cardano-ogmios/schema";

export class Ogmios {
  monitorClient: TxMonitorClient;
  submissionClient: TxSubmissionClient;
  stateClient: StateQueryClient;
  logger: Logger;

  constructor() {
    this.logger = createLogger({
      level: "verbose",
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "info.log", level: "info" }),
        new winston.transports.File({ filename: "verbose.log" }),
      ],
    });
  }

  async setupOgmios() {
    const context = await this.createContext();
    this.monitorClient = await createTxMonitorClient(context);
    this.submissionClient = await createTxSubmissionClient(context);
    this.stateClient = await createStateQueryClient(context);

    return {
      client: this.monitorClient,
      submissionClient: this.submissionClient,
      stateClient: this.stateClient,
    };
  }

  private createContext = () =>
    createInteractionContext(
      (err) => console.error(err),
      () => console.log("Connection closed."),
      { connection: { host: "192.168.1.73", port: 1337 } }
    );

  async fetchTransactions() {
    const slot = await this.monitorClient.awaitAcquire();

    this.logger.verbose(`Acquired new slot: ${slot}`);
    return (await this.fetchAllTxs()) ?? [];
  }

  private async fetchAllTxs(): Promise<TxAlonzo[]> {
    const tx = await this.monitorClient.nextTx({ fields: "all" });
    if (tx === null) {
      return [];
    }

    return [tx].concat(await this.fetchAllTxs()).filter((e) => e !== null); // recursive function to fetch all transactions until it returns null.
  }

  async getUTXOs(tx: string, index: number) {
    let utxos = await this.stateClient.utxo([
      {
        txId: tx,
        index: index,
      },
    ]);
    console.log(
      JSON.stringify(
        utxos,
        (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
      )
    );
  }
}
