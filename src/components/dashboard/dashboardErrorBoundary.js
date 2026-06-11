import React from "react";

export class DashboardErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
        this.handleRetry = this.handleRetry.bind(this);
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("dashboard block render failed", this.props?.container?.id, error, info);
    }

    componentDidUpdate(prevProps) {
        if (!this.state.error) {
            return;
        }
        if (
            prevProps?.container?.id !== this.props?.container?.id
            || prevProps?.children !== this.props?.children
        ) {
            this.setState({ error: null });
        }
    }

    handleRetry() {
        this.setState({ error: null });
    }

    render() {
        if (!this.state.error) {
            return this.props.children;
        }
        const Wrapper = this.props.wrapperComponent || React.Fragment;
        const wrapperProps = this.props.wrapperComponent
            ? { container: this.props.container }
            : {};
        const subtitleStyle = this.props.subtitleStyle && typeof this.props.subtitleStyle === "object"
            ? this.props.subtitleStyle
            : {};
        return React.createElement(
            Wrapper,
            wrapperProps,
            React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "10px" } },
                React.createElement(
                    "div",
                    {
                        style: {
                            ...subtitleStyle,
                            color: "#a82a2a",
                        },
                    },
                    `Failed to render dashboard block${this.props.container?.title ? `: ${this.props.container.title}` : "."}`,
                ),
                React.createElement(
                    "div",
                    null,
                    React.createElement(
                        "button",
                        {
                            type: "button",
                            onClick: this.handleRetry,
                            style: {
                                minHeight: 30,
                                padding: "0 12px",
                                borderRadius: 8,
                                border: "1px solid #d8dee8",
                                background: "#ffffff",
                                color: "#30404d",
                                cursor: "pointer",
                                font: "inherit",
                                fontSize: 12,
                                fontWeight: 600,
                            },
                        },
                        "Retry",
                    ),
                ),
            ),
        );
    }
}
