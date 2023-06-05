import { createTxMonitorClient, createTxSubmissionClient, createStateQueryClient, createInteractionContext, } from "@cardano-ogmios/client";
import winston, { createLogger } from "winston";
export class Ogmios {
    monitorClient;
    submissionClient;
    stateClient;
    logger;
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
    createContext = () => createInteractionContext((err) => console.error(err), () => console.log("Connection closed."), { connection: { host: "localhost", port: 1337 } });
    async fetchTransactions() {
        const slot = await this.monitorClient.awaitAcquire();
        this.logger.verbose(`Acquired new slot: ${slot}`);
        return (await this.fetchAllTxs()) ?? [];
    }
    async fetchAllTxs() {
        const tx = await this.monitorClient.nextTx({ fields: "all" });
        if (tx === null) {
            return null;
        }
        return [tx].concat(await this.fetchAllTxs()).filter((e) => e !== null); // recursive function to fetch all transactions until it returns null.
    }
    async getUTXOs(tx, index) {
        let utxos = await this.stateClient.utxo([
            {
                txId: tx,
                index: index,
            },
        ]);
        console.log(JSON.stringify(utxos, (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
        ));
    }
}
