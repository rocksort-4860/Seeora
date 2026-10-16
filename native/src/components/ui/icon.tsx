/**
 * ui/icon（重写版）：Lucide 图标直通包装。
 * 原 cssInterop(className→size) 依赖 NativeWind，已移除；尺寸/颜色由调用处 props 给出。
 */
import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react-native";

type IconProps = LucideProps & {
  as: LucideIcon;
};

function Icon({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />;
}

export { Icon };
