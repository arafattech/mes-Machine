import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private idSource = new BehaviorSubject<string | null>(null);
  id$ = this.idSource.asObservable();

  setId(id: string): void {
    this.idSource.next(id);
  }

  // Fired when the currently logged-in user's own profile image changes (uploaded via
  // model='Employee' against their own employee id) — the header avatar (layout.component)
  // subscribes to this so it updates immediately instead of waiting for a full reload.
  private profileImageSource = new BehaviorSubject<string | null>(null);
  profileImageUpdated$ = this.profileImageSource.asObservable();

  notifyProfileImageUpdated(url: string): void {
    this.profileImageSource.next(url);
  }
}
