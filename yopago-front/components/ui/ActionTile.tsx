import { Pressable, Text, View, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function ActionTile({
  title,
  subtitle,
  icon,
  onPress,
  accentColor,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  accentColor?: string;
}) {
  const scheme = useColorScheme() ?? "light";
  const c = Colors[scheme];
  const accent = accentColor ?? `${c.tint}1A`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: c.surface,
          borderRadius: c.radius.md,
          borderColor: c.divider,
          opacity: pressed ? 0.9 : 1,
          ...c.shadow.soft,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: accent }]}>{icon}</View>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    width: "48%",
    marginBottom: 14,
  },
  icon: {
    marginBottom: 12,
    borderRadius: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: "700", fontSize: 15, marginBottom: 2 },
  subtitle: { fontSize: 13 },
});
