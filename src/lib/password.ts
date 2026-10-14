// Signup-time password rules, shared by the form (instant feedback) and the
// signup API (the real enforcement). Deliberately not applied at login, so
// existing accounts with older/weaker passwords can still sign in.

const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop",
  "iloveyou", "letmein", "welcome1", "welcome123", "admin123", "abc12345",
  "football1", "monkey123", "dragon123", "sunshine1", "princess1", "changeme1",
]);

export function passwordIssue(password: string, email?: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password)) return "Include at least one letter.";
  if (!/\d/.test(password)) return "Include at least one number.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common. Pick something less guessable.";
  if (/^(.)\1+$/.test(password)) return "Don't repeat a single character.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Your password shouldn't contain your email name.";
  }
  return null;
}
