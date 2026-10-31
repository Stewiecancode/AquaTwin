import { Component, type ReactNode } from "react";
import { Button } from "./ui";

export class ViewerBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="panel" role="alert">
          <h2>The 3D workspace could not load</h2>
          <p>Reload to fetch the latest viewer files. You can still use the other pages and configure sensor placement below.</p>
          <Button onClick={() => window.location.reload()}>Reload workspace</Button>
        </section>
      );
    return this.props.children;
  }
}
