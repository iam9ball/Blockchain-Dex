import type { Currency, Pair, Token } from "@pancakeswap/sdk";
import { CurrencyAmount, JSBI, Percent } from "@pancakeswap/sdk";
import { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";

import { usePair } from "@src/hooks/usePairs";
import useTotalSupply from "@src/hooks/useTotalSupply";
import { useWeb3React } from "@src/hooks/useWeb3React";
import { useTokenBalances } from "@src/hooks/wallet";
import type { AppState } from "@src/redux/store";
import { useAppDispatch } from "@src/redux/store";
import tryParseAmount from "@src/utils/tryParseAmount";
import { wrappedCurrency } from "@src/utils/wrappedCurrency";

import { Field, typeInput } from "./actions";

export function useBurnState(): AppState["burn"] {
  return useSelector<AppState, AppState["burn"]>((state) => state.burn);
}

export function useDerivedBurnInfo(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  removalCheckedA?: boolean,
  removalCheckedB?: boolean,
  zapMode?: boolean
): {
  pair?: Pair | null;
  parsedAmounts: {
    [Field.LIQUIDITY_PERCENT]: Percent;
    [Field.LIQUIDITY]?: CurrencyAmount<Token>;
    [Field.CURRENCY_A]?: CurrencyAmount<Currency>;
    [Field.CURRENCY_B]?: CurrencyAmount<Currency>;
  };
  error?: string;
  tokenToReceive?: string;
  estimateZapOutAmount?: CurrencyAmount<Token>;
} {
  const { account, chainId } = useWeb3React();

  const { independentField, typedValue } = useBurnState();

  // pair + totalsupply
  const [, pair] = usePair(currencyA, currencyB);

  // balances
  const relevantTokenBalances = useTokenBalances(
    account ?? undefined,
    useMemo(() => [pair?.liquidityToken], [pair?.liquidityToken])
  );
  const userLiquidity: undefined | CurrencyAmount<Token> =
    relevantTokenBalances?.[pair?.liquidityToken?.address ?? ""];

  const [tokenA, tokenB] = [
    wrappedCurrency(currencyA, chainId),
    wrappedCurrency(currencyB, chainId),
  ];
  const tokens = {
    [Field.CURRENCY_A]: tokenA,
    [Field.CURRENCY_B]: tokenB,
    [Field.LIQUIDITY]: pair?.liquidityToken,
  };

  // liquidity values
  const totalSupply = useTotalSupply(pair?.liquidityToken);
  const liquidityValueA =
    pair &&
    totalSupply &&
    userLiquidity &&
    tokenA &&
    // this condition is a short-circuit in the case where useTokenBalance updates sooner than useTotalSupply
    JSBI.greaterThanOrEqual(JSBI.BigInt(Number(totalSupply.quotient)), JSBI.BigInt(Number(userLiquidity.quotient)))
      ? CurrencyAmount.fromRawAmount(
          tokenA,
          pair.getLiquidityValue(tokenA, totalSupply, userLiquidity, false)
            .quotient
        )
      : undefined;

  const liquidityValueB =
    pair &&
    totalSupply &&
    userLiquidity &&
    tokenB &&
    // this condition is a short-circuit in the case where useTokenBalance updates sooner than useTotalSupply
    JSBI.greaterThanOrEqual(JSBI.BigInt(Number(totalSupply.quotient)), JSBI.BigInt(Number(userLiquidity.quotient)))
      ? CurrencyAmount.fromRawAmount(
          tokenB,
          pair.getLiquidityValue(tokenB, totalSupply, userLiquidity, false)
            .quotient
        )
      : undefined;
  const liquidityValues: {
    [Field.CURRENCY_A]?: CurrencyAmount<Token>;
    [Field.CURRENCY_B]?: CurrencyAmount<Token>;
  } = {
    [Field.CURRENCY_A]: liquidityValueA,
    [Field.CURRENCY_B]: liquidityValueB,
  };

  let percentToRemove: Percent = new Percent("0", "100");
  // user specified a %
  if (independentField === Field.LIQUIDITY_PERCENT) {
    percentToRemove = new Percent(
      Number.isNaN(Number(typedValue)) ? 1 : typedValue,
      "100"
    );
  }
  // user specified a specific amount of liquidity tokens
  else if (independentField === Field.LIQUIDITY) {
    if (pair?.liquidityToken) {
      const independentAmount = tryParseAmount(typedValue, pair.liquidityToken);
      if (
        independentAmount &&
        userLiquidity &&
        !independentAmount.greaterThan(userLiquidity)
      ) {
        percentToRemove = new Percent(
          independentAmount.quotient,
          userLiquidity.quotient
        );
      }
    }
  }
  // user specified a specific amount of token a or b
  else if (tokens[independentField]) {
    const independentAmount = tryParseAmount(
      typedValue,
      tokens[independentField]
    );
    const liquidityValue = liquidityValues[independentField];
    if (
      independentAmount &&
      liquidityValue &&
      !independentAmount.greaterThan(liquidityValue)
    ) {
      percentToRemove = new Percent(
        independentAmount.quotient,
        liquidityValue.quotient
      );
    }
  }

  const liquidityToRemove =
    userLiquidity && percentToRemove && percentToRemove.greaterThan("0")
      ? CurrencyAmount.fromRawAmount(
          userLiquidity.currency,
          percentToRemove.multiply(userLiquidity.quotient).quotient
        )
      : undefined;

  const tokenToReceive =
    removalCheckedA && removalCheckedB
      ? undefined
      : removalCheckedA
      ? tokens[Field.CURRENCY_A]?.address
      : tokens[Field.CURRENCY_B]?.address;

  const amountA =
    tokenA &&
    percentToRemove &&
    percentToRemove.greaterThan("0") &&
    liquidityValueA
      ? CurrencyAmount.fromRawAmount(
          tokenA,
          percentToRemove.multiply(liquidityValueA.quotient).quotient
        )
      : undefined;

  const amountB =
    tokenB &&
    percentToRemove &&
    percentToRemove.greaterThan("0") &&
    liquidityValueB
      ? CurrencyAmount.fromRawAmount(
          tokenB,
          percentToRemove.multiply(liquidityValueB.quotient).quotient
        )
      : undefined;

  const tokenAmountToZap =
    removalCheckedA && removalCheckedB
      ? undefined
      : removalCheckedA
      ? amountB
      : amountA;

  const estimateZapOutAmount = useMemo(() => {
    if (pair && tokenAmountToZap) {
      try {
        return pair.getOutputAmount(tokenAmountToZap)[0];
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }, [pair, tokenAmountToZap]);

  const parsedAmounts: {
    [Field.LIQUIDITY_PERCENT]: Percent;
    [Field.LIQUIDITY]?: CurrencyAmount<Token>;
    [Field.CURRENCY_A]?: CurrencyAmount<Token>;
    [Field.CURRENCY_B]?: CurrencyAmount<Token>;
  } = {
    [Field.LIQUIDITY_PERCENT]: percentToRemove,
    [Field.LIQUIDITY]: liquidityToRemove,
    [Field?.CURRENCY_A]: !zapMode
      ? amountA
      : amountA && removalCheckedA && !removalCheckedB && estimateZapOutAmount
      ? CurrencyAmount.fromRawAmount(
          tokenA as any,
          JSBI.add(
            percentToRemove.multiply((liquidityValueA as any)?.quotient).quotient as any,
            estimateZapOutAmount.quotient as any
          ) as any
        )
      : !removalCheckedA
      ? undefined
      : amountA,
    [Field?.CURRENCY_B]: !zapMode
      ? amountB
      : amountB && removalCheckedB && !removalCheckedA && estimateZapOutAmount
      ? CurrencyAmount.fromRawAmount(
          tokenB as any,
          JSBI.add(
            percentToRemove.multiply((liquidityValueB as any)?.quotient).quotient as any,
            estimateZapOutAmount.quotient as any
          ) as any
        )
      : !removalCheckedB
      ? undefined
      : amountB,
  };

  let error: string | undefined;
  if (!account) {
    error = "Connect Wallet";
  }

  if (
    !parsedAmounts[Field.LIQUIDITY] ||
    (removalCheckedA && !parsedAmounts[Field.CURRENCY_A]) ||
    (removalCheckedB && !parsedAmounts[Field.CURRENCY_B])
  ) {
    error = error ?? "Enter an amount";
  }

  return { pair, parsedAmounts, error, tokenToReceive, estimateZapOutAmount };
}

export function useBurnActionHandlers(): {
  onUserInput: (field: Field, typedValue: string) => void;
} {
  const dispatch = useAppDispatch();

  const onUserInput = useCallback(
    (field: Field, typedValue: string) => {
      dispatch(typeInput({ field, typedValue }));
    },
    [dispatch]
  );

  return {
    onUserInput,
  };
}
