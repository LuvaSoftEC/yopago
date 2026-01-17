import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { LoginForm } from "@/components/auth/LoginForm";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GuestAccessModal } from "@/components/auth/GuestAccessModal";
import Button from "@/components/ui/Button";
import { AuthGradientColors, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRouter, type Href } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

export default function LoginScreen() {
  const scheme = useColorScheme() ?? "light";
  const c = Colors[scheme];
  const isDark = scheme === "dark";
  const router = useRouter();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const gradientColors = (isDark ? AuthGradientColors.dark : AuthGradientColors.light) as [string, string, ...string[]];

  const handleLoginSuccess = () => {
    router.replace("/" as Href);
  };

  const handleSwitchToRegister = () => {
    router.push("/register" as Href);
  };

  const openGuestModal = () => {
    setShowGuestModal(true);
  };

  const closeGuestModal = () => {
    setShowGuestModal(false);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.background }]}> 
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.accentCircle, styles.circleTop, {
        backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.15)",
      }]} />
      <View style={[styles.accentCircle, styles.circleBottom, {
        backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(34, 197, 94, 0.12)",
      }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.authCard,
            {
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.88)",
              borderColor: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(255, 255, 255, 0.7)",
              shadowColor: isDark ? "#0f172a" : "#93c5fd",
            },
            c.shadow.card,
          ]}
        >
          <View style={styles.brandBadgeWrapper}>
            <View
              style={[styles.brandBadge, { backgroundColor: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255,255,255,0.9)", borderColor: c.divider }]}
            >
              <View style={[styles.brandDot, { backgroundColor: c.tint }]} />
              <ThemedText style={styles.brandText}>Yopago</ThemedText>
            </View>
          </View>
          {/* Hero eliminado para versión móvil más compacta */}
          <View style={styles.formSection}>
            <ThemedText
              style={{
                textAlign: 'center',
                fontWeight: '800',
                fontSize: 15,
                marginBottom: 14,
                letterSpacing: 0.5,
                backgroundColor: 'transparent',
                color: '#22d3ee',
                textShadowColor: 'rgba(34,211,238,0.18)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
              }}
            >
              💡 Comparte y divide tus gastos, <ThemedText style={{ color: '#38bdf8', fontWeight: '900' }}>¡sin olvidar ninguno!</ThemedText>
            </ThemedText>
            <ThemedText type="title" style={styles.title}>Iniciar Sesión</ThemedText>
            {/* Subtítulo eliminado para ahorrar espacio */}
            <LoginForm
              onLoginSuccess={handleLoginSuccess}
              onSwitchToRegister={handleSwitchToRegister}
              style={styles.loginFormStyles}
              variant="plain"
              showDemoUsers={false}
            />
            <View style={styles.guestAccessContainer}>
              <ThemedText style={styles.guestAccessLabel}>¿Tienes un código de invitado?</ThemedText>
              <Button
                title="Ingresar como invitado"
                variant="secondary"
                onPress={openGuestModal}
                fullWidth
              />
            </View>
            <View style={{ alignItems: 'center', marginTop: 18 }}>
              <ThemedText style={{ color: '#22d3ee', fontWeight: '600', fontSize: 14, textAlign: 'center' }} onPress={handleSwitchToRegister}>
                ¿No tienes cuenta? <ThemedText style={{ color: '#38bdf8', textDecorationLine: 'underline', fontWeight: '700' }}>Regístrate</ThemedText>
              </ThemedText>
            </View>
          </View>
          {/* Footer LuVaSoft */}
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <ThemedText style={{ fontSize: 13, color: '#7dd3fc', opacity: 0.7 }}>by LuVaSoft</ThemedText>
          </View>
        </View>
      </ScrollView>
      <GuestAccessModal visible={showGuestModal} onClose={closeGuestModal} />
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
    borderRadius: 18, // antes 28
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 18, // antes 32
    paddingBottom: 14, // antes 24
    paddingHorizontal: 12, // antes 28
  },
  brandBadgeWrapper: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brandText: {
    fontSize: 15, // antes 18
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeHelper: {
    fontSize: 12, // antes 14
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cardHero: {
    display: 'none', // oculto en móvil
  },
  title: {
    textAlign: 'center',
    fontSize: 18, // más pequeño
    fontWeight: '700',
  },
  subtitle: {
    display: 'none', // oculto
  },
  formSection: {
    padding: 4,
    gap: 18,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 22, // antes 30
    fontWeight: '700',
    color: '#ffffff',
  },
  heroBody: {
    fontSize: 14, // antes 16
    lineHeight: 20, // antes 24
  },
  loginFormStyles: {
    alignSelf: 'stretch',
  },
  guestAccessContainer: {
    marginTop: 20,
    marginBottom: 8,
  },
  guestAccessLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
    color: '#38bdf8',
    fontWeight: '600',
  },
  accentCircle: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.7,
  },
  circleTop: {
    top: -60,
    right: -40,
  },
  circleBottom: {
    bottom: -80,
    left: -60,
  },
});
