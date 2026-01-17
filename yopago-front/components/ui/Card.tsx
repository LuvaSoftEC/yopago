import { View, ViewProps, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function Card({ style, children, ...rest }: ViewProps) {
  const scheme = useColorScheme() ?? "light";
  const c = Colors[scheme];
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderRadius: c.radius.lg,
          ...c.shadow.card,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    marginHorizontal: 16,
  },
});
