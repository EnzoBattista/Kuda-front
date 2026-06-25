import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: ToastMessage[] = [];
  public toasts$ = new Subject<ToastMessage[]>();
  private idCounter = 0;

  show(message: string, type: 'success' | 'error' | 'info' = 'success', durationMs: number = 5000): void {
    const id = this.idCounter++;
    const toast: ToastMessage = { id, type, message };
    
    this.toasts.push(toast);
    this.toasts$.next([...this.toasts]);

    if (durationMs > 0) {
      setTimeout(() => this.remove(id), durationMs);
    }
  }

  showSuccess(message: string): void {
    this.show(message, 'success');
  }

  showError(message: string): void {
    this.show(message, 'error');
  }

  showInfo(message: string): void {
    this.show(message, 'info');
  }

  remove(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.toasts$.next([...this.toasts]);
  }
}
