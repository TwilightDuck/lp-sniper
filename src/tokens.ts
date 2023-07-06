import Big from "big.js";
import { ArbitragePair, CexplorerToken, Token } from "./types";

export async function getTokens(): Promise<Token[]> {
  let response = await fetch(
    "https://js.cexplorer.io/api-static/asset/list.json"
  );
  return (await response.json()).data.map((t: CexplorerToken) => {
    return <Token>{
      ticker: t.registry_ticker,
      policy: t.policy,
      asset: t.name,
      unit: t.policy + t.name,
      decimals: t.registry_decimal,
      quantity: Big(t.quantity),
    };
  });
}

var arbitragePairs: ArbitragePair[] = [];

export function getArbitragePairs() {
  return arbitragePairs;
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
  let allAmms: string[][] = allTokenPairs.map((_) => []);

  allTokenPairs.forEach(([t0, t1], i) => {
    let _i = i;
    ["Minswap", "Sundaeswap"].forEach((f) => {
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
        };
        arbitragePairs.push(ap);
      }
    }
  });
}