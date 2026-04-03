"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface TradePanelErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface TradePanelErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class TradePanelErrorBoundary extends Component<
  TradePanelErrorBoundaryProps,
  TradePanelErrorBoundaryState
> {
  constructor(props: TradePanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): TradePanelErrorBoundaryState {
    return { hasError: true, message: error.message || "Something went wrong." };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[Siren] TradePanelErrorBoundary", error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="fixed bottom-4 right-4 z-[200] max-w-sm rounded-xl border p-4 shadow-lg"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-1)",
          }}
        >
          <p className="font-heading text-sm font-semibold mb-1">
            {this.props.fallbackTitle ?? "Trade panel error"}
          </p>
          <p className="font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
            {this.state.message}
          </p>
          <button
            type="button"
            className="mt-3 w-full py-2 rounded-lg font-body text-xs font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
