export const CHAIN_MAINNET = 'mainnet'
export const CHAIN_TESTNET = 'testnet'
export const CHAIN_PRIVATENET = "privatenet"

export const ALGO_ASSET_ID = 0
export const ALGO_ZERO_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

// ORDER ROUTER
export const TYPE_FIXED_INPUT = 'fixed-input'
export const TYPE_FIXED_OUTPUT = 'fixed-output'
export const FETCH_QUOTE_API = 'fetchQuote'
export const FETCH_EXECUTE_SWAP_TXNS_API = 'fetchExecuteSwapTxns'
export const ORDER_ROUTER_DEFAULT_FEE_BPS = 4
export const DEFAULT_MAX_GROUP_SIZE = 16

// LIMIT ORDERS
export const PROTOCOL_TREASURY_APP_IDS = {
    [CHAIN_MAINNET]: 896396059,
    [CHAIN_TESTNET]: 115034817,
    [CHAIN_PRIVATENET]: 63784,
}

export const REGISTRY_APP_IDS = {
    [CHAIN_MAINNET]: 896397031,
    [CHAIN_TESTNET]: 115034998,
    [CHAIN_PRIVATENET]: 63785,
}
export const LIMIT_ORDER_MIN_FEE_BPS = 6
