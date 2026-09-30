import { Component, forwardRef, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AngularEditorConfig, AngularEditorModule } from "@kolkov/angular-editor";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

@Component({
  selector: "app-angular-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, AngularEditorModule],
  templateUrl: "./angular-editor.component.html",
  styleUrls: ["./angular-editor.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AngularEditorComponent),
      multi: true,
    },
  ],
})
export class AngularEditorComponent implements ControlValueAccessor {
  @Input() isReadonly = false;
  @Input() editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: "200px",
    minHeight: "100px",
    translate: "no",
    defaultParagraphSeparator: "p",
    defaultFontName: "Arial",
  };

  value: string = "";

  // ControlValueAccessor handlers
  private onChange: any = () => {};
  private onTouched: any = () => {};

  writeValue(value: any): void {
    this.value = value || "";
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  // Called when content changes
  onContentChange(event: string) {
    this.value = event;
    this.onChange(event);
    this.onTouched();
  }

  get resolvedEditorConfig(): AngularEditorConfig {
    return {
      ...this.editorConfig,
      editable: !this.isReadonly,
    };
  }
}
