import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ui5FioriModule, Ui5MainModule } from '@ui5/webcomponents-ngx';
import { FormsModule } from '@angular/forms';
import { DeleteEntityComponent } from '@shared/components/delete-entity/delete-entity.component';
import { AssosiateComponent } from '@shared/components/assosiate/assosiate.component';
import { AttachmentPreviewComponent } from '@shared/components/attachment-preview/attachment-preview.component';
import { AttachmentUploadComponent } from '@shared/components/attachment-upload/attachment-upload.component';
import { NgChartsModule } from 'ng2-charts';
import { BarChartComponent } from '@app/modules/production-management/shared/components/bar-chart/bar-chart.component';
import { LineChartComponent } from '@app/modules/production-management/shared/components/line-chart/line-chart.component';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import { CalendarComponent } from '@app/shared/components/calender/calender.component';
import { ExcelImportExportComponent } from '@shared/components/excel-import-export/excel-import-export.component';
import { ClientFormComponent } from '@app/modules/base-data-management/client-management/client-form/client-form.component';
import { ServerDropdownComponent } from '@shared/components/server-dropdown/server-dropdown.component';
@NgModule({
  declarations: [
    ClientFormComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    Ui5MainModule,
    Ui5FioriModule,
    DeleteEntityComponent,
    AssosiateComponent,
    AttachmentPreviewComponent,
    AttachmentUploadComponent,
    NgChartsModule,
    BarChartComponent,
    LineChartComponent,
    AgGridTableComponent,
    CalendarComponent,
    ExcelImportExportComponent,
    ServerDropdownComponent
  ],
  exports: [
    DeleteEntityComponent,
    AssosiateComponent,
    AttachmentPreviewComponent,
    AttachmentUploadComponent,
    CommonModule,
    FormsModule,
    Ui5MainModule,
    Ui5FioriModule,
    NgChartsModule,
    BarChartComponent,
    LineChartComponent,
    AgGridTableComponent,
    CalendarComponent,
    ExcelImportExportComponent,
    ClientFormComponent,
    ServerDropdownComponent,
  ],
})
export class SharedModule {}
