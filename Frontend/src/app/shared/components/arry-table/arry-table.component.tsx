import { CommonModule } from "@angular/common";
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import {
  TableCellComponent,
  TableGrowingComponent,
  TableHeaderCellComponent,
  TableComponent,
  Ui5MainModule,
  TableHeaderRowComponent,
} from "@ui5/webcomponents-ngx";
import { AssosiateComponent } from "@app/shared/components/assosiate/assosiate.component";
import { FormsModule } from "@angular/forms";
import { CommonService } from "@app/services/common-service/common.service";
import { AnalyticalTableComponent } from "@app/shared/components/analytical-table/analytical-table.component";
import { Button, Icon, TextAlign } from "@ui5/webcomponents-react";
import React from "react";
import { Product } from "@app/shared/model/product";

@Component({
  selector: "app-arry-table",
  standalone: true,
  imports: [
    Ui5MainModule,
    CommonModule,
    AnalyticalTableComponent,
    AssosiateComponent,
    FormsModule,
    TableComponent,
    TableCellComponent,
    TableHeaderRowComponent,
    TableHeaderCellComponent,
    TableGrowingComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./arry-table.component.html",
  styleUrl: "./arry-table.component.scss",
})
export class ArryTableComponent implements OnInit, OnChanges {
  @Output() IsAssosiateModal = new EventEmitter<any>();
  @Input() Associate: any;
  @Input() model: any;
  @Input() tableColumn: any;
  @Output() getStaticData = new EventEmitter<any>();
  @Input() getSelectedSuppliers = new EventEmitter<any>();
  @Output() SentSelectedData = new EventEmitter<any>();
  @Input() loading: boolean | undefined;
  @Input() selecteditem: any;
  @Input() IsOpen: any;

  ProductList = Product;
  IsAssosiate: boolean = false;
  EmptyRow: any;
  SelectedData: any[] = [];
  InitialRowNumber: number = 10;
  FilterData: any[] = [];
  SearchText: string = "";
  odata: boolean;

  constructor(private commonServiece: CommonService) {
    this.odata = commonServiece.odata;
    this.model = new Object();
  }

  ngOnInit(): void {
    this.GenetateEmptyRow();
    this.getSelectedSuppliers.subscribe((data: any) => {
      this.FilterData = data;
      this.getStaticData.emit(this.FilterData);
    });
  }

  handleInsertData(isInsert: boolean) {
    if (isInsert) {
      this.IsAssosiateModal.emit();
    }
  }
  IsAssosiateClick() {
    this.IsAssosiateModal.emit();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes["IsOpen"] && this.IsOpen) {
      if (!this.IsOpen) {
        this.FilterData = [];
      }

      this.commonServiece
        .get(`Products/${this.selecteditem.id}?$expand=suppliers`, this.odata)
        .subscribe({
          next: (items: any) => {
            Object.values(items.suppliers).map((item) => {
              this.FilterData.push(item);
            });
          },
        });
    }
  }

  GetSelectedData(data: any) {
    this.SelectedData = data;
    if (this.SearchText == "") {
      this.FilterData = this.SelectedData;
      this.SentSelectedData.emit(this.FilterData);
    }
    this.GenetateEmptyRow();
  }

  onInputChange() {
    this.FilterData = this.SelectedData.filter((items: any) =>
      items.name.toLowerCase().includes(this.SearchText.toLowerCase())
    );
    this.GenetateEmptyRow();
  }

  GenetateEmptyRow() {
    if (this.FilterData.length < this.InitialRowNumber) {
      this.EmptyRow = Array.from(
        { length: this.InitialRowNumber - this.FilterData.length },
        (_, i) => i + 1
      );
    } else {
      this.EmptyRow = Array.from({ length: 0 }, (_, i) => i + 1);
    }
  }

  tableColum() {
    const columns = [
      {
        Header: "Active",
        accessor: "is_active",
        autoResizable: true,
        disableGroupBy: true,
        disableFilters: true,
        width: 80,
        className: "custom-class-name",
        hAlign: "Center" as TextAlign,
        Cell: ({ value }: any) =>
          value ? <Icon name="accept" /> : <Icon name="decline" />,
      },
      {
        Header: "ID",
        accessor: "custom_id",
        autoResizable: true,
        disableGroupBy: true,
        disableFilters: true,
        width: 100,
        hAlign: "Center" as TextAlign,
        className: "custom-class-name",
      },
      {
        Header: "Name",
        accessor: "name",
        autoResizable: true,
        className: "custom-class-name",
      },
      {
        Header: "Created At",
        accessor: "created_at",
        disableFilters: true,
        autoResizable: true,
        className: "custom-class-name",
        hAlign: "Center" as TextAlign,
        Cell: ({ value }: any) => new Date(value).toLocaleDateString(),
      },
      {
        Header: "   Actions",
        accessor: ".",
        cellLabel: () => "",
        disableFilters: true,
        disableGroupBy: true,
        disableSortBy: true,
        autoResizable: true,
        id: "actions",
        width: 100,
        className: "custom-class-name",
        hAlign: "Center" as TextAlign,
        Cell: ({ row }: any) => (
          <div>
            <Button
              icon="delete"
              design="Transparent"
              onClick={() => {
                this.removeData(row.original);
              }}
            ></Button>
          </div>
        ),
      },
    ];
    return columns;
  }

  removeData(data: any) {
    this.FilterData = this.FilterData.filter((item: any) => item.id != data.id);
    this.getStaticData.emit(this.FilterData);
  }
}
