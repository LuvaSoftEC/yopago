import { LinearGradient } from "expo-linear-gradient";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AuthGradientColors, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRouter, type Href } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

export default function RegisterScreen() {
	const scheme = useColorScheme() ?? "light";
	const c = Colors[scheme];
	const isDark = scheme === "dark";
	const router = useRouter();

	const handleSwitchToLogin = () => {
		router.replace("/login" as Href);
	};

	return (
		<ThemedView style={[styles.container, { backgroundColor: c.background }]}>
			<LinearGradient
				colors={[
					(isDark ? AuthGradientColors.dark[0] : AuthGradientColors.light[0]),
					(isDark ? AuthGradientColors.dark[1] : AuthGradientColors.light[1]),
					...(isDark ? AuthGradientColors.dark.slice(2) : AuthGradientColors.light.slice(2)),
				]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>

			<View
				style={[
					styles.accentCircle,
					styles.circleTop,
					{ backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.15)" },
				]}
			/>
			<View
				style={[
					styles.accentCircle,
					styles.circleBottom,
					{ backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(34, 197, 94, 0.12)" },
				]}
			/>

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContainer}
				keyboardShouldPersistTaps="handled"
			>
				<View
					style={[
						styles.authCard,
						{
							backgroundColor: isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)",
							borderColor: isDark ? "rgba(148,163,184,0.25)" : "rgba(255,255,255,0.7)",
							shadowColor: isDark ? "#0f172a" : "#a7f3d0",
						},
						c.shadow.card,
					]}
				>
					<View style={styles.formSection}>
						<ThemedText
							type="title"
							style={[styles.title, { textAlign: 'center', fontSize: 18, fontWeight: '700' }]}
						>
							Crear cuenta
						</ThemedText>

						<RegisterForm
							onSwitchToLogin={handleSwitchToLogin}
							onRegisterSuccess={handleSwitchToLogin}
							style={styles.registerFormStyles}
							variant="plain"
						/>
						<View style={{ marginTop: 24, alignItems: 'center' }}>
							<ThemedText style={{ fontSize: 13, color: '#7dd3fc', opacity: 0.7 }}>by LuVaSoft</ThemedText>
						</View>
					</View>
				</View>
			</ScrollView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
	scrollContainer: {
		flexGrow: 1,
		justifyContent: 'flex-start',
		alignItems: 'stretch',
		paddingHorizontal: 24,
		paddingTop: 56,
		paddingBottom: 32,
	},
	authCard: {
		alignSelf: 'stretch',
		width: '100%',
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
		paddingTop: 18,
		paddingBottom: 14,
		paddingHorizontal: 12,
	},
	formSection: {
		padding: 4,
		gap: 18,
	},
	title: {
		textAlign: 'center',
		fontSize: 18,
		fontWeight: '700',
	},
	subtitle: {
		display: 'none',
	},
	registerFormStyles: {
		alignSelf: 'stretch',
	},
	accentCircle: {
		position: 'absolute',
		width: 240,
		height: 240,
		borderRadius: 120,
		opacity: 0.7,
	},
	circleTop: {
		top: -50,
		left: -40,
	},
	circleBottom: {
		bottom: -70,
		right: -60,
	},
});
