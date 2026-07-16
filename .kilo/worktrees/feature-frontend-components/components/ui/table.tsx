import * as React from "react";
import { cn } from "@/lib/utils";

type DivLikeProps = React.HTMLAttributes<HTMLElement> & {
    className?: string;
};

type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
    className?: string;
};

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
    className?: string;
};

export const Table = React.forwardRef<HTMLDivElement, DivLikeProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn("w-full overflow-x-auto", className)}
                {...props}
            >
                <div className="inline-block min-w-full align-middle">
                    {children}
                </div>
            </div>
        );
    },
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
    HTMLTableSectionElement,
    DivLikeProps
>(({ className, children, ...props }, ref) => (
    <thead
        ref={ref as any}
        className={cn(
            "bg-muted text-muted-foreground sticky top-0 z-10 dark:bg-black dark:text-white",
            className,
        )}
        {...props}
    >
        {children}
    </thead>
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
    HTMLTableSectionElement,
    DivLikeProps
>(({ className, children, ...props }, ref) => (
    <tbody
        ref={ref as any}
        className={cn("bg-background dark:bg-black dark:text-white", className)}
        {...props}
    >
        {children}
    </tbody>
));
TableBody.displayName = "TableBody";

export const TableCaption = React.forwardRef<
    HTMLTableCaptionElement,
    DivLikeProps
>(({ className, children, ...props }, ref) => (
    <caption
        ref={ref as any}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    >
        {children}
    </caption>
));
TableCaption.displayName = "TableCaption";

export const TableRow = React.forwardRef<HTMLTableRowElement, DivLikeProps>(
    ({ className, children, ...props }, ref) => (
        <tr
            ref={ref as any}
            className={cn(
                "border-t last:border-b dark:border-neutral-800",
                className,
            )}
            {...props}
        >
            {children}
        </tr>
    ),
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
    ({ className, children, ...props }, ref) => (
        <th
            ref={ref as any}
            scope="col"
            className={cn(
                "px-1.5 py-1 text-left text-[11px] font-semibold text-muted-foreground align-middle dark:text-white",
                className,
            )}
            {...props}
        >
            {children}
        </th>
    ),
);
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
    ({ className, children, ...props }, ref) => (
        <td
            ref={ref as any}
            className={cn(
                "px-1.5 py-1 align-middle text-[11px] whitespace-nowrap overflow-hidden text-ellipsis dark:text-white",
                className,
            )}
            {...props}
        >
            {children}
        </td>
    ),
);
TableCell.displayName = "TableCell";

export default Table;
