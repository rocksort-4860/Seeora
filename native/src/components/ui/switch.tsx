/**
 * ui/switch（重写版）：RN 原生 Switch 包装（替换 @rn-primitives/switch）。
 * 对外接口保持 checked / onCheckedChange 不变，调用点零改动。
 * 颜色语义：开=品牌强调色，关=c.line（原 bg-input 令牌）。
 */
import * as React from "react";
import { Switch as RNSwitch } from "react-native";
import { useApp } from "@/store/app";

type SwitchProps = Omit<React.ComponentProps<typeof RNSwitch>, "value" | "onValueChange"> & {
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
};

function Switch({ checked = false, onCheckedChange, disabled, ...props }: SwitchProps) {
  const { colors: c } = useApp();
  return (
    <RNSwitch
      value={checked}
      onValueChange={onCheckedChange}
      disabled={disabled}
      trackColor={{ false: c.line, true: c.accent }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={c.line}
      {...props}
    />
  );
}

export { Switch };
