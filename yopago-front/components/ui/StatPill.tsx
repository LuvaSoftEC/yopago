import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function StatPill({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme() ?? "light";
  const c = Colors[scheme];
  return (
    <View style={[styles.wrap, { backgroundColor: c.surface }]}>
      <View style={[styles.dot, { backgroundColor: c.success }]} />
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 999, marginRight: 8 },
  value: { fontWeight: "700", marginRight: 6 },
  label: { fontSize: 12 },
});
