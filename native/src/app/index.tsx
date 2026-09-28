/**
 * Tabs 容器：History（左）/ Today（中，默认）/ Settings（右）
 * 首次启动（!visited）叠加 Onboarding 全屏引导
 */
import "react-native-gesture-handler";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { CalendarDays, History, Settings } from "lucide-react-native";
import { useApp } from "@/store/app";
import { Onboarding } from "@/app/onboarding";

export default function TabsLayout() {
  const { colors, t, visited, hydrated } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="today"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.ink4,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="history"
          options={{ title: t("tabHistory"), tabBarIcon: ({ color, size }) => <Icon as={History} color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="today"
          options={{ title: t("tabToday"), tabBarIcon: ({ color, size }) => <Icon as={CalendarDays} color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: t("tabSettings"), tabBarIcon: ({ color, size }) => <Icon as={Settings} color={color} size={size} /> }}
        />
      </Tabs>
      {hydrated && !visited && <Onboarding />}
    </View>
  );
}
