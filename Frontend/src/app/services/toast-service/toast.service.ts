import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastType =
  | 'save'
  | 'add'
  | 'edit'
  | 'delete'
  | 'remove'
  | 'read'
  | 'approve'
  | 'import'
  | 'export'
  | 'password'
  | 'download'
  | 'error'
  | 'exist';



export interface ToastPayload {
  type: ToastType;
  message?: string;
  // Persistent toasts stay open (no auto-hide) — used for live progress
  // updates that get replaced/closed explicitly by a later show() call.
  persist?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastSubject = new Subject<ToastPayload>();

  toast$ = this.toastSubject.asObservable();

  show(type: ToastType, message?: string, persist: boolean = false) {
    this.toastSubject.next({ type, message, persist });
  }
}
