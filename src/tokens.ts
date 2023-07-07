import { Asset, CexplorerToken, Token } from "./types";

export async function getTokens(): Promise<Asset[]> {
  let result = await fetch(
    "https://js.cexplorer.io/api-static/asset/list.json"
  );

  let json = await result.json();
  let data: Asset[] = json.data.map((t: CexplorerToken) => {
    return new Asset(t.policy, t.name, t.registry_decimal);
  });
  return data;
}
