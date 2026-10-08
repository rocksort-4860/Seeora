/**
 * 设置 › 关于（About）
 * 路由：/settings/about
 * 形态对齐 iOS：App 图标 + 名称 + 版本独立成组，下方分组列版权与法务入口。
 */
import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/store/app";
import { Group, GroupTitle, NavHeader, Row } from "@/components/SettingsUI";

const VERSION = "1.0.0";

export default function AboutScreen() {
  const { dict: d, colors: c } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/settings"));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top }}>
        <NavHeader title={d.about} backLabel={d.back} subtitle={d.settingsTitle} colors={c} onBack={back} />
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingBottom: 40 }}>
        {/* App 标识区：图标 + 名称 + 版本 */}
        <View style={{ alignItems: "center", marginTop: 18, marginBottom: 30 }}>
          <View
            style={{
              width: 78, height: 78, borderRadius: 17,
              backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 34, fontWeight: "800" }}>S</Text>
          </View>
          <Text style={{ color: c.ink, fontSize: 22, fontWeight: "700", marginTop: 12 }}>
            Seeora
          </Text>
          <Text style={{ color: c.ink3, fontSize: 15, marginTop: 3 }}>
            {d.version.replace("{v}", VERSION)}
          </Text>
        </View>

        <GroupTitle colors={c}>{d.about}</GroupTitle>
        <Group colors={c}>
          <Row label={d.version} value={VERSION} colors={c} first />
          <Row label={d.localPromise} colors={c} last />
        </Group>

        <GroupTitle colors={c}>{d.privacy}</GroupTitle>
        <Group colors={c}>
          {/* ★ 隐私政策入口暂不外链：**正式域名尚未确定**（本地只有 landing/privacy/terms/support
             四个 .html 文件，仓库里没有任何已上线域名）。
             iOS 审核要求 Privacy Policy 必须有**可公网访问的 URL**，ASC 后台也要填同一个地址。
             域名定下来后，把下面这行换成：
               onPress={() => Linking.openURL("<正式域名>/privacy.html")}
             现在只展示说明文字，避免 App 里出现打不开的假链接。 */}
          <Row label={d.privacy} colors={c} first last />
        </Group>
        <Text
          style={{ color: c.ink3, fontSize: 13, lineHeight: 18, marginHorizontal: 22, marginTop: -6 }}
          maxFontSizeMultiplier={1.5}
        >
          {d.privacyText}
        </Text>
      </ScrollView>
    </View>
  );
}