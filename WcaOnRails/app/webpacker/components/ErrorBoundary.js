// must be a class component, not a function component
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    const { hasError } = this.state;
    const { children, errorMessage } = this.props;

    if (hasError) {
      // You can render any custom fallback UI
      return errorMessage || <h1>Something went wrong.</h1>;
    }

    return children;
  }
}
