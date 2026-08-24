// ============================================================
//  MEPHDA — Design System
// ============================================================

// --- Palette brute -----------------------------------------
export const PALETTE = {
  blue900: "#0A3880",
  blue800: "#0D47A1",
  blue600: "#1976D2",
  blue100: "#E3EDFB",
  blue50:  "#F0F5FE",

  green700: "#1B5E20",
  green600: "#2E7D32",
  green100: "#E6F2E7",

  orange600: "#F57C00",
  orange100: "#FDF0E1",

  red600: "#D32F2F",
  red100: "#FBE9E9",

  grey900: "#111418",
  grey700: "#3D4650",
  grey500: "#6B7684",
  grey300: "#C9D1DA",
  grey200: "#E4E9EF",
  grey100: "#F5F7FA",
  white:   "#FFFFFF",
};

// --- Rôles sémantiques -------------------------------------
export const C = {
  // primaires
  primary:      PALETTE.blue800,
  primaryDark:  PALETTE.blue900,
  primaryLight: PALETTE.blue600,
  primarySoft:  PALETTE.blue100,

  // états
  success:     PALETTE.green600,
  successSoft: PALETTE.green100,
  warning:     PALETTE.orange600,
  warningSoft: PALETTE.orange100,
  danger:      PALETTE.red600,
  dangerSoft:  PALETTE.red100,

  // surfaces
  bg:      PALETTE.grey100,
  surface: PALETTE.white,
  border:  PALETTE.grey200,

  // texte
  text:       PALETTE.grey900,
  textMuted:  PALETTE.grey700,
  textSubtle: PALETTE.grey500,
  onPrimary:  PALETTE.white,

  // ---- alias de compatibilité (ancien code) ----
  teal:      PALETTE.blue800,
  tealDeep:  PALETTE.blue900,
  tealLight: PALETTE.green600,
  cream:     PALETTE.grey100,
  paper:     PALETTE.white,
  ink:       PALETTE.grey900,
  ochre:     PALETTE.orange600,
  brick:     PALETTE.red600,
  sidebar:   PALETTE.blue900,
};

// --- Typographie -------------------------------------------
const FAMILY = "'Inter', 'Poppins', 'Segoe UI', system-ui, sans-serif";

export const T = {
  display:  { fontFamily: FAMILY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 },
  title:    { fontFamily: FAMILY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3 },
  subtitle: { fontFamily: FAMILY, fontSize: 18, fontWeight: 600, lineHeight: 1.4 },
  body:     { fontFamily: FAMILY, fontSize: 16, fontWeight: 400, lineHeight: 1.6 },
  bodyBold: { fontFamily: FAMILY, fontSize: 16, fontWeight: 600, lineHeight: 1.5 },
  small:    { fontFamily: FAMILY, fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  smallBold:{ fontFamily: FAMILY, fontSize: 14, fontWeight: 600, lineHeight: 1.5 },
  caption:  { fontFamily: FAMILY, fontSize: 12, fontWeight: 500, lineHeight: 1.4 },
  overline: { fontFamily: FAMILY, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
};

// --- Espacements (échelle 4 px) -----------------------------
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
};

// --- Rayons -------------------------------------------------
export const R = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999,
};

// --- Ombres (très légères) ----------------------------------
export const SHADOW = {
  xs: "0 1px 2px rgba(16, 24, 40, 0.04)",
  sm: "0 2px 8px rgba(16, 24, 40, 0.06)",
  md: "0 4px 16px rgba(16, 24, 40, 0.08)",
  lg: "0 12px 32px rgba(16, 24, 40, 0.10)",
  focus: `0 0 0 4px ${PALETTE.blue100}`,
};

// --- Compat ancien code -------------------------------------
export const serif = { fontFamily: FAMILY, fontWeight: 700, letterSpacing: "-0.01em" };
export const mono  = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };

export const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: R.md,
  border: `1.5px solid ${C.border}`,
  background: C.surface,
  fontSize: 16,
  fontFamily: FAMILY,
  color: C.text,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .15s ease, box-shadow .15s ease",
};