import { Component, type ReactNode } from "react";

/** Optional presentation must never unmount the room that owns the connection. */
export class PlayFeatureBoundary extends Component<{
  children: ReactNode;
  fallback?: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback ?? null : this.props.children;
  }
}
