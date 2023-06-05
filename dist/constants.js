import { Constr, getAddressDetails } from "lucid-cardano";
export var Min;
(function (Min) {
    Min.LP_NFT_POLICY_ID = "0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1";
    Min.OUTPUT_ADA = 2000000n;
    Min.BATCHER_FEE = 2000000n;
    // 0 is Testnet
    // 1 is Mainnet
    Min.STAKE_ORDER_ADDRESS = "addr1zxn9efv2f6w82hagxqtn62ju4m293tqvw0uhmdl64ch8uw6j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq6s3z70";
    let StepType;
    (function (StepType) {
        StepType[StepType["SWAP_EXACT_IN"] = 0] = "SWAP_EXACT_IN";
        StepType[StepType["SWAP_EXACT_OUT"] = 1] = "SWAP_EXACT_OUT";
        StepType[StepType["DEPOSIT"] = 2] = "DEPOSIT";
        StepType[StepType["WITHDRAW"] = 3] = "WITHDRAW";
        StepType[StepType["ONE_SIDE_DEPOSIT"] = 4] = "ONE_SIDE_DEPOSIT";
    })(StepType = Min.StepType || (Min.StepType = {}));
    let MetadataMessage;
    (function (MetadataMessage) {
        MetadataMessage["CANCEL_ORDER"] = "Minswap: Cancel Order";
        MetadataMessage["SWAP_EXACT_IN_ORDER"] = "Minswap: Swap Exact In Order";
    })(MetadataMessage = Min.MetadataMessage || (Min.MetadataMessage = {}));
})(Min || (Min = {}));
export var LucidCredential;
(function (LucidCredential) {
    function toPlutusData(data) {
        const constructor = data.type === "Key" ? 0 : 1;
        return new Constr(constructor, [data.hash]);
    }
    LucidCredential.toPlutusData = toPlutusData;
})(LucidCredential || (LucidCredential = {}));
export var AddressPlutusData;
(function (AddressPlutusData) {
    function toPlutusData(address) {
        const addressDetails = getAddressDetails(address);
        if (addressDetails.type === "Base") {
            const stakeCredConstr = addressDetails.stakeCredential
                ? new Constr(0, [
                    new Constr(0, [
                        LucidCredential.toPlutusData(addressDetails.stakeCredential),
                    ]),
                ])
                : new Constr(1, []);
            return new Constr(0, [
                LucidCredential.toPlutusData(addressDetails.paymentCredential),
                stakeCredConstr,
            ]);
        }
        if (addressDetails.type === "Enterprise") {
            return new Constr(0, [
                LucidCredential.toPlutusData(addressDetails.paymentCredential),
                new Constr(1, []),
            ]);
        }
        throw new Error("only supports base address, enterprise address");
    }
    AddressPlutusData.toPlutusData = toPlutusData;
})(AddressPlutusData || (AddressPlutusData = {}));
