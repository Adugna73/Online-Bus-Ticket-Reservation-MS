import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", children, ...props }: CardProps) {
    return (
        <div
            className={`rounded-lg border bg-card text-card-foreground ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ className = "", children, ...props }: CardProps) {
    return (
        <div className={`px-4 py-3 border-b ${className}`} {...props}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className = "" }: any) {
    return <h3 className={`text-sm font-semibold ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = "" }: any) {
    return (
        <p className={`text-xs text-muted-foreground ${className}`}>
            {children}
        </p>
    );
}

export function CardContent({ className = "", children, ...props }: CardProps) {
    return (
        <div className={`p-4 ${className}`} {...props}>
            {children}
        </div>
    );
}

export function CardFooter({ className = "", children, ...props }: CardProps) {
    return (
        <div className={`px-4 py-3 border-t ${className}`} {...props}>
            {children}
        </div>
    );
}

export default Card;
