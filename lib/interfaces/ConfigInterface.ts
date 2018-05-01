import AddressInterface from "./AddressInterface";

export default interface ConfigInterface {
  blockchain: {
    mintAddress: string;
    mintReward: number;
    difficulty?: number,
    nodeAddress?: AddressInterface;
  };
  http: {
    port?: number,
  };
  advertisedHost: string;
  addressOpts: {
    bits: number;
    e: number;
  };
  database: {
    database: string;
    username: string;
    password: string;
    storage: string;
  };
}
