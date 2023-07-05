import { ArbitragePair, Token } from "./types";


const quoteTokens: Token[] = [
    {
        ticker: 'YUMMI',
        policyid: '078eafce5cd7edafdf63900edef2c1ea759e77f30ca81d6bbdeec924',
        asset: '79756d6d69',
        unit: '078eafce5cd7edafdf63900edef2c1ea759e77f30ca81d6bbdeec924.79756d6d69',
        decimals: 0
    },
    {
        ticker: 'MILK',
        policyid: '8a1cfae21368b8bebbbed9800fec304e95cce39a2a57dc35e2e3ebaa',
        asset: '4d494c4b',
        unit: '8a1cfae21368b8bebbbed9800fec304e95cce39a2a57dc35e2e3ebaa.4d494c4b',
        decimals: 0
    }, {
        ticker: 'EMP',
        policyid: '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81',
        asset: '456d706f7761',
        unit: '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81.456d706f7761',
        decimals: 6
    }, {
        ticker: 'LQ',
        policyid: 'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24',
        asset: '4c51',
        unit: 'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24.4c51',
        decimals: 6
    }, {
        ticker: 'STABLE',
        policyid: '2adf188218a66847024664f4f63939577627a56c090f679fe366c5ee',
        asset: '535441424c45',
        unit: '2adf188218a66847024664f4f63939577627a56c090f679fe366c5ee.535441424c45',
        decimals: 0
    }, {
        ticker: 'IAG',
        policyid: '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114',
        asset: '494147',
        unit: '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114.494147',
        decimals: 6
    }, {
        ticker: 'AADA',
        policyid: '8fef2d34078659493ce161a6c7fba4b56afefa8535296a5743f69587',
        asset: '41414441',
        unit: '8fef2d34078659493ce161a6c7fba4b56afefa8535296a5743f69587.41414441',
        decimals: 6
    }, {
        ticker: 'INDY',
        policyid: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
        asset: '494e4459',
        unit: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0.494e4459',
        decimals: 6
    }, {
        ticker: 'AGIX',
        policyid: 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535',
        asset: '41474958',
        unit: 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535.41474958',
        decimals: 8
    }, {
        ticker: 'CHRY',
        policyid: '75fcc276057db5fc48eae0e11453c773c8a54604c3086bf9d95ac1b7',
        asset: '43485259',
        unit: '75fcc276057db5fc48eae0e11453c773c8a54604c3086bf9d95ac1b7.43485259',
        decimals: 6
    }, {
        ticker: 'VYFI',
        policyid: '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f',
        asset: '56594649',
        unit: '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f.56594649',
        decimals: 6
    }, {
        ticker: 'iUSD',
        policyid: 'f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880',
        asset: '69555344',
        unit: 'f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880.69555344',
        decimals: 6
    }, {
        ticker: 'DjedMicroUSD',
        policyid: '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61',
        asset: '446a65644d6963726f555344',
        unit: '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61.446a65644d6963726f555344',
        decimals: 6
    },
];

var arbitragePairs: ArbitragePair[] = [];

export function getArbitragePairs() {
    return arbitragePairs;
}

export function getQuoteTokens() {
    return quoteTokens;
}


export async function initializePairs() {
    // form token pairs [token0, token1]
    let allTokenPairs: [string, Token][] = [];
    quoteTokens.forEach((q) => {
        allTokenPairs.push(["lovelace", q]);
    });

    // for each token pair, we find all AMMs that support this pair
    // by calling the AMM factory getPair() method to get the pair address
    // and store the pair addresses in allAmms
    let allAmms: string[][] = allTokenPairs.map(_ => []);

    allTokenPairs.forEach(([t0, t1], i) => {
        let _i = i;
        ['Minswap', 'Sundaeswap'].forEach(f => {
            allAmms[_i].push(f);
        });
    });


    allTokenPairs.forEach(([t0, t1], i) => {
        let amms = allAmms[i];
        for (var j = 0; j < amms.length; j += 1) {
            for (var k = j + 1; k < amms.length; k += 1) {
                let ap: ArbitragePair = {
                    baseToken: t0,
                    quoteToken: t1,
                    pair0: { dex: amms[j], token0: t0, token1: t1 },
                    pair1: { dex: amms[k], token0: t0, token1: t1 },
                }
                arbitragePairs.push(ap);
            }
        }
    });
}