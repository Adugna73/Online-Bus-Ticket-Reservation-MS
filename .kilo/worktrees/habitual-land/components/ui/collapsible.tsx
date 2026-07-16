import * as React from "react";

type CollapsibleContextType = {
    open: boolean;
    toggle: () => void;
};

const CollapsibleContext = React.createContext<CollapsibleContextType | null>(
    null
);

export function Collapsible({
    children,
    defaultOpen = false,
    asChild = false,
    className = "",
}: {
    children: React.ReactNode;
    defaultOpen?: boolean;
    asChild?: boolean;
    className?: string;
}) {
    const [open, setOpen] = React.useState<boolean>(defaultOpen);

    const ctx = React.useMemo(
        () => ({ open, toggle: () => setOpen((s) => !s) }),
        [open]
    );

    // render a wrapper element that sets data-state for styling
    return (
        <CollapsibleContext.Provider value={ctx}>
            <div data-state={open ? "open" : "closed"} className={className}>
                {children}
            </div>
        </CollapsibleContext.Provider>
    );
}

export function CollapsibleTrigger({
    asChild = false,
    children,
    ...props
}: any) {
    const ctx = React.useContext(CollapsibleContext);
    if (!ctx) return null;

    const onClick = (e: any) => {
        if (props?.onClick) props.onClick(e);
        ctx.toggle();
    };

    if (asChild) {
        // expect a single child element
        return React.cloneElement(React.Children.only(children) as any, {
            onClick,
            "data-state": ctx.open ? "open" : "closed",
        });
    }

    return (
        <button
            {...props}
            onClick={onClick}
            data-state={ctx.open ? "open" : "closed"}
        >
            {children}
        </button>
    );
}

export function CollapsibleContent({ children, className = "" }: any) {
    const ctx = React.useContext(CollapsibleContext);
    if (!ctx) return null;
    return (
        <div className={className} data-state={ctx.open ? "open" : "closed"}>
            {ctx.open ? children : null}
        </div>
    );
}

export default Collapsible;
