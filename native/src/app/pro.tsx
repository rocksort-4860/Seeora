/**
 * Pro 买断页（Seeora）：modal 路由 /pro
 * 由 usePro.openPro / gatePro 经 nav.push("/pro") 调起；关闭调用 closePro()
 * 价格动态读取（见 @/lib/iap），买断按钮展开 Pay Sheet（payVisible）
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Gem, X } from "lucide-react-native";
import { useApp } from "@/store/app";
import { usePlanPrices, priceLabel } from "@/lib/iap";
import { Text as T } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ProScreen() {
  const { dict: d, colors: c, pro, closePro, openPay, closePay, payVisible, payDone, payRestore } = useApp();
  const insets = useSafeAreaInsets();
  const { prices, ready } = usePlanPrices(payVisible);
  const price = priceLabel(prices, "l", ready, d.proLoading);

  const benefits = [d.proPermanent, d.proNoSub, d.proNoAccount, d.proDataYours];

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-row items-center justify-between px-5 pb-2" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-[26px] font-extrabold tracking-tight" style={{ color: c.ink }}>{d.proTitle}</Text>
        <Pressable
          onPress={closePro}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: c.surface2 }}
          accessibilityLabel={d.close}
        >
          <Icon as={X} color={c.ink2} size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="mt-2 items-center py-4">
          <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: c.accent }}>
            <Icon as={Gem} color="#fff" size={30} />
          </View>
          <Text className="mt-3 text-[24px] font-extrabold" style={{ color: c.ink }}>{d.proLifetime}</Text>
          <T className="mt-1 text-sm" style={{ color: c.ink3 }}>{d.slogan}</T>
        </View>

        <View className="mt-3 gap-2.5">
          {benefits.map((b, i) => (
            <View key={i} className="flex-row items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
              <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: c.surface2 }}>
                <Icon as={Check} color={c.accent} size={15} />
              </View>
              <T className="flex-1 text-[15px]" style={{ color: c.ink }}>{b}</T>
            </View>
          ))}
        </View>

        <T className="mt-4 text-sm leading-6" style={{ color: c.ink3 }}>{d.buyoutBody}</T>

        {pro ? (
          <View className="mt-5 flex-row items-center justify-center gap-2 rounded-xl py-4" style={{ backgroundColor: c.surface }}>
            <Icon as={Check} color={c.success} size={18} />
            <T className="text-base font-semibold" style={{ color: c.success }}>{d.proOwned}</T>
          </View>
        ) : (
          <Button className="mt-5 h-12" style={{ backgroundColor: c.accent }} onPress={openPay}>
            <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.proBuy}</Text>
          </Button>
        )}
      </ScrollView>

      {/* Pay Sheet：展开购买 / 恢复 */}
      <Dialog open={payVisible} onOpenChange={(o) => !o && closePay()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[21px] font-extrabold">{d.payTitle}</DialogTitle>
            <T className="mt-1 text-sm" style={{ color: c.ink3 }}>{d.payStore}</T>
          </DialogHeader>
          <View className="items-center py-3">
            <Text className="text-[40px] font-extrabold tabular-nums" style={{ color: c.accent }}>{price}</Text>
          </View>
          <DialogFooter className="gap-2 flex-col">
            <Button className="h-12 w-full" style={{ backgroundColor: c.accent }} onPress={() => { void payDone(); }}>
              <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.proBuy}</Text>
            </Button>
            <Button variant="outline" className="h-11 w-full" onPress={() => { void payRestore(); }}>
              <Text className="text-base font-medium" style={{ color: c.ink }}>{d.proRestore}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
