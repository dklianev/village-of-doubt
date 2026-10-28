import { Component, type ReactNode } from "react";
import { captureClientException } from "@/lib/sentry-client";

type OptionalFeatureBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  /** A change (e.g. the pathname) gives a failed feature another try without remounting a healthy one. */
  resetKey?: unknown;
};

/** Optional presentation must not unmount the page or its live connection. */
export class OptionalFeatureBoundary extends Component<OptionalFeatureBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    captureClientException(error);
  }

  componentDidUpdate(previous: OptionalFeatureBoundaryProps) {
    if (this.state.failed && !Object.is(previous.resetKey, this.props.resetKey)) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback ?? null : this.props.children;
  }
}
