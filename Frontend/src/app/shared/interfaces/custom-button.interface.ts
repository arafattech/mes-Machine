import ButtonDesign from "@ui5/webcomponents/dist/types/ButtonDesign";

export interface ICustomButton {
    id: string;
    text?: string;
    tooltip?: string;
    icon?: string;
    disable?: Function;
    design?: ButtonDesign;
    hide?: Function;
    onClick: Function;
}