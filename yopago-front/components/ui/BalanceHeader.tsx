import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function BalanceHeader({
  balance,
  changePct,
}: {
  balance: string;
  changePct?: string;
}) {
  const scheme = useColorScheme() ?? "light";
  const c = Colors[scheme];
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: c.primary,
          borderBottomLeftRadius: c.radius.lg,
          borderBottomRightRadius: c.radius.lg,
        },
      ]}
    >
      <Text style={[styles.caption, { color: "#E4F1EF" }]}>Your Wallet</Text>
      <Text style={[styles.amount, { color: "white" }]}>{balance}</Text>
      {changePct ? (
        <View style={styles.pill}>
          <Text style={{ color: c.accent, fontWeight: "700" }}>▲ {changePct}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 24, paddingBottom: 28, paddingHorizontal: 20 },
  caption: { opacity: 0.9, marginBottom: 6 },
  amount: { fontSize: 34, fontWeight: "800", letterSpacing: 0.4 },
  pill: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
