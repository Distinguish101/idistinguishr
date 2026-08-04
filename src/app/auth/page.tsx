// SCREEN 5 — Sign Up / Login
// Covers: US-12 (signup after time selection), US-13 (login), US-14 (OAuth)
// Reference mockup: mockups.html → #auth
// Reference spec: booking-flow-spec.md → "5. Sign Up / Login"
//
// TODO:
// - Toggle Sign Up / Login
// - Sign Up: name, email, password → bcrypt hash → create User(role=STUDENT)
// - Google OAuth via next-auth (already wired in src/lib/auth.ts)
// - Context banner showing the in-progress booking (teacher + date/time) so
//   the user doesn't lose their place — pull from the pending Booking id
// - On success → /checkout

export default function AuthPage() {
  return (
    <main>
      <h1>Sign Up / Login</h1>
      <p>Auth forms + OAuth + booking context banner. See TODO comments above.</p>
    </main>
  );
}
