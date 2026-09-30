import { Component, Input } from '@angular/core';

interface TilePalette {
  /** SAP theme CSS var driving icon color and border. */
  color: string;
  /** SAP theme CSS var for the tile/icon-chip tint background. */
  tint: string;
}

const NEUTRAL_PALETTE: TilePalette = {
  color: 'var(--sapContent_LabelColor, #556b82)',
  tint: 'var(--sapList_Background, #f2f2f2)',
};

/** Config-tile accent palettes, keyed by semantic meaning (not literal color) —
 * matches the sap var convention used across the rest of this page. */
const CONFIG_PALETTE = {
  info: {
    color: 'var(--sapInformationColor, #427cac)',
    tint: 'var(--sapInformationBackground, #e8f4fe)',
  },
  critical: {
    color: 'var(--sapCriticalColor, #e76500)',
    tint: 'var(--sapWarningBackground, #fef7f1)',
  },
  negative: {
    color: 'var(--sapNegativeColor, #bb0000)',
    tint: 'var(--sapErrorBackground, #ffebeb)',
  },
};

@Component({
  selector: 'app-machine-details',
  templateUrl: './machine-details.component.html',
  styleUrl: './machine-details.component.scss',
})
export class MachineDetailsComponent {
  @Input() machine: {
    id: string;
    name: string;
    status: string;
    maxRpm: number;
    minRpm: number;
    maxTemp: number;
    minTemp: number;
  } | null = null;

  readonly palette = CONFIG_PALETTE;

  /** Configured (value present) → the given semantic accent; unconfigured → neutral/muted. */
  configTile(value: number | null | undefined, accent: TilePalette) {
    const active = !!value;
    return {
      color: active ? accent.color : NEUTRAL_PALETTE.color,
      tint: active ? accent.tint : NEUTRAL_PALETTE.tint,
      dashed: !active,
    };
  }
}
