/**
 * ui/text（重写版）：直接透传 RN Text。
 * 原 shadcn 变体体系依赖 NativeWind className，已按功能文档 §11.1 移除；
 * 字号/字重/颜色一律由调用处 style 显式给出。
 */
import * as React from "react";
import { Text as RNText } from "react-native";

type TextProps = React.ComponentProps<typeof RNText>;

function Text(props: TextProps) {
  return <RNText {...props} />;
}

export { Text };
