import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import {
  Pair,
  Swap as SwapEvent,
  Token,
  Transaction,
} from "../generated/schema";

import {
  Swap,
} from "../generated/templates/Pair/Pair";

import {
  PairCreated,
} from '../generated/Factory/Factory'

import {
  ERC20
} from '../generated/Factory/ERC20'

import {
  Pair as PairTemplate 
} from '../generated/templates'

import { log } from '@graphprotocol/graph-ts'

let ZERO_BI = BigInt.fromI32(0);
let ONE_BI = BigInt.fromI32(1);
const CELO_ADDRESS = "0x471ece3750da237f93b8e339c536989b8978a438";

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString("1");
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString("10"));
  }
  return bd;
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  if (tokenAddress.toHexString() == CELO_ADDRESS) {
    return "CELO";
  }
  let contract = ERC20.bind(tokenAddress);
  let symbolValue = "unknown";
  let symbolResult = contract.try_symbol();
  if (!symbolResult.reverted) {
    symbolValue = symbolResult.value;
  }
  return symbolValue;
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  if (
    tokenAddress.toHexString() == "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"
  ) {
    return BigInt.fromI32(18);
  }
  let contract = ERC20.bind(tokenAddress);
  let decimalValue = null;
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value;
  }
  return BigInt.fromI32(decimalValue);
}

export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal();
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function fetchTokenName(tokenAddress: Address): string {
  if (tokenAddress.toHexString() == CELO_ADDRESS) {
    return "Celo Native Asset";
  }
  let contract = ERC20.bind(tokenAddress);
  let nameValue = "unknown";
  let nameResult = contract.try_name();
  if (!nameResult.reverted) {
    nameValue = nameResult.value;
  }

  return nameValue;
}

export function handleSwap(event: Swap): void {
  log.debug("This is a swap", [event.transaction.hash.toHexString()]);
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.swaps = [];
  }
  let swaps = transaction.swaps;
  let swap = new SwapEvent(
    event.transaction.hash
      .toHexString()
      .concat("-")
      .concat(BigInt.fromI32(swaps.length).toString())
  );

  let pair = Pair.load(event.address.toHexString());
  let token0 = Token.load(pair.token0);
  let token1 = Token.load(pair.token1);

  let amount0In = convertTokenToDecimal(
    event.params.amount0In,
    token0.decimals
  );
  let amount1In = convertTokenToDecimal(
    event.params.amount1In,
    token1.decimals
  );
  let amount0Out = convertTokenToDecimal(
    event.params.amount0Out,
    token0.decimals
  );
  let amount1Out = convertTokenToDecimal(
    event.params.amount1Out,
    token1.decimals
  );

  swap.transaction = transaction.id;
  swap.pair = pair.id;
  swap.timestamp = transaction.timestamp;
  swap.transaction = transaction.id;
  swap.sender = event.params.sender;
  swap.amount0In = amount0In
  swap.amount1In = amount1In;
  swap.amount0Out = amount0Out;
  swap.amount1Out = amount1Out;
  swap.to = event.params.to;
  swap.from = event.transaction.from;
  swap.logIndex = event.logIndex;

  swap.save();
  swaps.push(swap.id);
  transaction.swaps = swaps;
  transaction.save();  
}

export function handleNewPair(event: PairCreated): void {
  let token0 = Token.load(event.params.token0.toHexString());
  let token1 = Token.load(event.params.token1.toHexString());

  if (token0 === null) {
    token0 = new Token(event.params.token0.toHexString());
    token0.symbol = fetchTokenSymbol(event.params.token0);
    token0.name = fetchTokenName(event.params.token0);
    let decimals = fetchTokenDecimals(event.params.token0);
    if (decimals === null) {
      return;
    }

    token0.decimals = decimals;
  }

  if (token1 === null) {
    token1 = new Token(event.params.token1.toHexString());
    token1.symbol = fetchTokenSymbol(event.params.token1);
    token1.name = fetchTokenName(event.params.token1);
    let decimals = fetchTokenDecimals(event.params.token1);

    if (decimals === null) {
      return;
    }
    token1.decimals = decimals;
  } 
  
  let pair = new Pair(event.params.pair.toHexString()) as Pair;
  pair.token0 = token0.id;
  pair.token1 = token1.id;
  pair.createdAtTimestamp = event.block.timestamp;
  pair.createdAtBlockNumber = event.block.number;

  PairTemplate.create(event.params.pair);
  
  token0.save();
  token1.save();
  pair.save();
}