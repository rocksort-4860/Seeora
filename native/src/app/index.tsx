/**
 * Tabs 容器：History（左）/ Today（中，默认）/ Settings（右）
 */
import "react-native-gesture-handler";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { CalendarDays, History, Settings } from "lucide-react-native";
import { useApp } from "@/store/app";

export default function TabsLayout() {
  const { colors, t } = useApp();
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
    </View>
  );
}
