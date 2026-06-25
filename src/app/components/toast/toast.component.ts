import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastMessage, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let toast of toasts" class="toast" [ngClass]="toast.type">
        <span>{{ toast.message }}</span>
        <button class="close-btn" (click)="close(toast.id)" aria-label="Cerrar">&times;</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .toast {
      padding: 1rem;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-width: 250px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out forwards;
    }
    .toast.success { background-color: #2e7d32; }
    .toast.error { background-color: #d32f2f; }
    .toast.info { background-color: #0288d1; }
    
    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 1.25rem;
      cursor: pointer;
      line-height: 1;
      opacity: 0.8;
      padding: 0;
    }
    .close-btn:hover {
      opacity: 1;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  private sub?: Subscription;

  constructor(private readonly toastService: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(id: number): void {
    this.toastService.remove(id);
  }
}
