export interface ButtonConfig {
    title: string;
    width?: string;
    height?: string;
    display?: boolean;
    disabled?:boolean,
    design?: "Positive" | "Negative" | "Default" | "Transparent" | "Emphasized" | "Attention" ;
    callback: () => any;
}
