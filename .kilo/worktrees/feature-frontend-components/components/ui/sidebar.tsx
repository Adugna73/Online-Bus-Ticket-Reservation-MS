import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

type PropsWithClass = React.HTMLAttributes<HTMLElement> & {
    className?: string;
};

export type SidebarProps = PropsWithClass & {
    collapsible?: "icon" | boolean | "none";
};

export function Sidebar({
    className = "",
    children,
    collapsible,
    ...props
}: SidebarProps) {
    const collapsed = collapsible === "icon";
    const base = collapsed ? "w-16" : "w-64";
    return (
        <aside
            data-collapsed={collapsed ? "true" : "false"}
            className={`${base} h-full bg-card border-r ${className}`}
            {...props}
        >
            {children}
        </aside>
    );
}

export function SidebarContent({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <div className={`p-3 h-full ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarGroup({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <div className={`mb-4 ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarCollapsibleGroup({
    label,
    defaultOpen = true,
    className = "",
    children,
}: {
    label: React.ReactNode;
    defaultOpen?: boolean;
} & PropsWithClass) {
    const [open, setOpen] = React.useState<boolean>(defaultOpen);

    return (
        <div className={`mb-4 ${className}`}>
            <div className="flex items-center justify-between px-2">
                <div className="text-xs font-semibold text-muted-foreground">
                    {label}
                </div>
                <button
                    aria-expanded={open}
                    onClick={() => setOpen((s) => !s)}
                    className="p-1 rounded hover:bg-muted/50"
                    aria-label={open ? "Collapse group" : "Expand group"}
                >
                    <svg
                        className={`w-3 h-3 transition-transform ${
                            open ? "rotate-90" : "rotate-0"
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
                    </svg>
                </button>
            </div>
            <div
                className={`mt-2 overflow-hidden transition-[max-height] duration-200 ease-in-out ${
                    open ? "max-h-[1000px]" : "max-h-0"
                }`}
            >
                {children}
            </div>
        </div>
    );
}

export function SidebarGroupLabel({ children, className = "" }: any) {
    return (
        <div
            className={`text-xs font-semibold px-2 text-muted-foreground ${className}`}
        >
            {children}
        </div>
    );
}

export function SidebarGroupContent({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <div className={`mt-2 ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarHeader({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <div className={`px-3 py-2 border-b ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarFooter({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <div className={`px-3 py-2 border-t mt-auto ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarRail({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <div
            className={`hidden md:block absolute right-0 top-0 bottom-0 w-6 bg-muted/10 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function SidebarMenu({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <ul className={`space-y-1 ${className}`} {...props}>
            {children}
        </ul>
    );
}

export function SidebarMenuItem({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <li className={`${className}`} {...props}>
            {children}
        </li>
    );
}

export interface SidebarMenuButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
}

export const SidebarMenuButton = React.forwardRef<any, SidebarMenuButtonProps>(
    ({ className = "", asChild = false, children, ...props }, ref) => {
        const Comp: any = asChild ? Slot : "button";
        const title = (props as any).tooltip;
        const extra: any = {};
        if (title) extra.title = title;
        return (
            <Comp
                ref={ref}
                className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded hover:bg-muted/50 ${className}`}
                {...extra}
                {...props}
            >
                {children}
            </Comp>
        );
    }
);
SidebarMenuButton.displayName = "SidebarMenuButton";

export function SidebarMenuSub({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <ul className={`pl-4 space-y-1 ${className}`} {...props}>
            {children}
        </ul>
    );
}

export function SidebarMenuSubItem({
    className = "",
    children,
    ...props
}: PropsWithClass) {
    return (
        <li className={`${className}`} {...props}>
            {children}
        </li>
    );
}

export const SidebarMenuSubButton = React.forwardRef<
    any,
    SidebarMenuButtonProps
>(({ className = "", asChild = false, children, ...props }, ref) => {
    const Comp: any = asChild ? Slot : "button";
    return (
        <Comp
            ref={ref}
            className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 ${className}`}
            {...props}
        >
            {children}
        </Comp>
    );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";
export default Sidebar;
