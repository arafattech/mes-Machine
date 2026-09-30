export enum SprStatus {
    SUBMITTED = 'SUBMITTED',
    APPROVED = 'APPROVED',
    FINAL_APPROVAL = 'FINAL_APPROVAL',
    REJECTED = 'REJECTED',
    PARTIALLY_APPROVED = 'PARTIALLY_APPROVED',
}

export function gmStatusBadge(status?: string): string {
    switch (status) {
        case SprStatus.APPROVED:
        case SprStatus.FINAL_APPROVAL:
            return 'APPROVED';
        case SprStatus.REJECTED:
            return 'REJECTED';
        default:
            return 'pending';
    }
}

export function generalStatusBadge(status?: string): string {
    switch (status) {
        case SprStatus.FINAL_APPROVAL:
            return 'APPROVED';
        case SprStatus.REJECTED:
            return 'REJECTED';
        default:
            return 'pending';
    }
}

export enum SprType {
    SPR = 'SPR',
    SR = 'SR',
}

export enum RequisitionUrgency {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
}

export class SprStatusClass {
    constructor() {}

    // Translate enum value to display text
    static getStateTranslate(state: SprStatus): string {
        switch (state) {
            case SprStatus.SUBMITTED:
                return $localize`Submitted`;
            case SprStatus.APPROVED:
                return $localize`Approved`;
            case SprStatus.FINAL_APPROVAL:
                return $localize`Final Approved`;
            case SprStatus.PARTIALLY_APPROVED:
                return $localize`Partially Approved`;
            case SprStatus.REJECTED:
                return $localize`Rejected`;
            default:
                return "";
        }
    }

    // Convert display text back to enum value
    static getStateValue(value: string): SprStatus | "" {
        switch (value) {
            case $localize`Submitted`:
                return SprStatus.SUBMITTED;
            case $localize`Approved`:
                return SprStatus.APPROVED;
            case $localize`Final Approved`:
                return SprStatus.FINAL_APPROVAL;
            case $localize`Partially Approved`:
                return SprStatus.PARTIALLY_APPROVED;
            case $localize`Rejected`:
                return SprStatus.REJECTED;
            default:
                return "";
        }
    }

    // Get array of enum values and their translated text (for dropdowns, etc.)
    static getEnumArray() {
        const enumArr: { value: SprStatus; text: string }[] = [];
        const elements = Object.keys(SprStatus) as Array<keyof typeof SprStatus>;
        elements.forEach(elm => {
            enumArr.push({ value: SprStatus[elm], text: this.getStateTranslate(SprStatus[elm]) });
        });
        return enumArr;
    }
}
