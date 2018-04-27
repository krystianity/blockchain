export default interface ConfigInterface {
  blockchain: {
    difficulty?: number,
  };
  http: {
    port?: number,
  };
  advertisedHost: string;
}
