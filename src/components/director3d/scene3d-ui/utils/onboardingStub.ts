// onboarding/onboardingState 临时 stub：引导记忆（localStorage）。
export function hasSeenScene3DCoach(): boolean {
  try {
    return window.localStorage.getItem('scene3d.coach.seen') === '1'
  } catch {
    return false
  }
}
export function resetScene3DCoachSeen(): void {
  try {
    window.localStorage.removeItem('scene3d.coach.seen')
  } catch {
    /* noop */
  }
}
export function markScene3DCoachSeen(): void {
  try {
    window.localStorage.setItem('scene3d.coach.seen', '1')
  } catch {
    /* noop */
  }
}
