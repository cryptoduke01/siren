/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "@polymarket/clob-client" {
  export const AssetType: any;
  export const OrderType: any;
  export const Side: any;
  export class ClobClient {
    constructor(host: string, chainId: number, signer: any, creds?: any, nonce?: number, address?: string);
    createOrDeriveApiKey(): Promise<any>;
    createOrder(opts: any): Promise<any>;
    postOrder(order: any, orderType?: any): Promise<any>;
    getOrderBook(...args: any[]): Promise<any>;
    getOpenOrders(params?: any): Promise<any[]>;
    getBalanceAllowance(params: any): Promise<any>;
    createAndPostMarketOrder(opts: any, options?: any, orderType?: any): Promise<any>;
  }
}
