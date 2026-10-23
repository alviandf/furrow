import { NativeTabs } from 'expo-router/native-tabs';

import { colors, fontFamily } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor={colors.leaf}
      iconColor={colors.inkMuted}
      labelStyle={{ fontFamily: fontFamily.bodyBold, fontSize: 11 }}>
      <NativeTabs.Trigger name="(farm)">
        <NativeTabs.Trigger.Label>Farm</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'leaf', selected: 'leaf.fill' }} md="eco" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="history" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
