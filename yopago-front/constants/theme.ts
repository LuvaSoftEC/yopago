// constants/theme.ts
import { Platform } from "react-native";
import type { TextStyle } from "react-native";

type Shadow = {
  card: object;
  soft: object;
};

type Radius = {
  xs: number; sm: number; md: number; lg: number; pill: number;
};

type Spacing = {
  xs: number; sm: number; md: number; lg: number; xl: number;
};

type FontSize = {
  title: number;
  h2: number;
  body: number;
  small: number;
};

type FontFamily = {
  regular: string;
  medium: string;
  semiBold: string;
  bold: string;
};

export type TypographyStyle = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'letterSpacing'> & {
  fontFamily: NonNullable<TextStyle['fontFamily']>;
};

export type TypographyVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'body'
  | 'bodyBold'
  | 'label'
  | 'caption'
  | 'overline'
  | 'button'
  | 'link';

type TypographyScale = Record<TypographyVariant, TypographyStyle>;

export type AppPalette = {
  background: string;
  primary: string; primary700: string; primary300: string; accent: string;
  success: string; warning: string;
  surface: string; surfaceAlt: string;
  text: string; textMuted: string; divider: string;
  tint: string;                 // <-- agrega esto
  radius: Radius;
  shadow: Shadow;
  spacing: Spacing;
  font: FontSize;
  fontFamily: FontFamily;
  typography: TypographyScale;
};

const typography: TypographyScale = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: 'Mulish-Bold', letterSpacing: -0.2 },
  title: { fontSize: 24, lineHeight: 32, fontFamily: 'Mulish-SemiBold' },
  headline: { fontSize: 20, lineHeight: 28, fontFamily: 'Mulish-SemiBold' },
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'Mulish-Regular' },
  bodyBold: { fontSize: 16, lineHeight: 24, fontFamily: 'Mulish-SemiBold' },
  label: { fontSize: 14, lineHeight: 20, fontFamily: 'Mulish-Medium' },
  caption: { fontSize: 12, lineHeight: 18, fontFamily: 'Mulish-Medium' },
  overline: { fontSize: 11, lineHeight: 14, fontFamily: 'Mulish-Medium', letterSpacing: 0.5 },
  button: { fontSize: 16, lineHeight: 20, fontFamily: 'Mulish-SemiBold' },
  link: { fontSize: 16, lineHeight: 24, fontFamily: 'Mulish-SemiBold' },
};

const base: {
  radius: Radius;
  shadow: Shadow;
  spacing: Spacing;
  font: FontSize;
  fontFamily: FontFamily;
  typography: TypographyScale;
} = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, pill: 999 },
  shadow: {
    card: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.10,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }) as object,
    soft: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }) as object,
  },
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
  font: { title: 28, h2: 20, body: 16, small: 13 },
  fontFamily: {
    regular: 'Mulish-Regular',
    medium: 'Mulish-Medium',
    semiBold: 'Mulish-SemiBold',
    bold: 'Mulish-Bold',
  },
  typography,
};

export const TYPOGRAPHY = typography;

export const Colors: Record<"light" | "dark", AppPalette> = {
  light: {
    background: "#F7FAF9",
    primary: "#0FB86E",
    primary700: "#0A8050",
    primary300: "#6EE7B7",
    accent: "#FF9F0A",
    success: "#22C55E",
    warning: "#FFC447",
    surface: "#FFFFFF",
    surfaceAlt: "#ECF5F1",
    text: "#0B1220",
    textMuted: "#5E6B84",
    divider: "rgba(11,18,32,0.08)",
    tint: "#0FB86E",
    ...base,
  },
  dark: {
    background: "#181C23",
    primary: "#22D184",
    primary700: "#1BA86A",
    primary300: "#6FF2A1",
    accent: "#2BA7FF",
    success: "#42E287",
    warning: "#F4B93C",
    surface: "#232B36",
    surfaceAlt: "#222834",
    text: "#F2F6FA",
    textMuted: "#8CA0B3",
    divider: "rgba(242,246,250,0.08)",
    tint: "#22D184",
    ...base,
  },
};


export const AuthGradientColors: Record<"light" | "dark", readonly string[]> = {
  light: ["#dcfce7", "#bbf7d0", "#f0fdf4"],
  dark: ["#052e16", "#0f172a", "#134e4a"],
};



export type AppTheme = typeof Colors["light"];
