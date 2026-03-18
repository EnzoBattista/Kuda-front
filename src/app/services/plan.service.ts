import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Plan } from '../models/plan.model';

@Injectable({
  providedIn: 'root',
})
export class PlanService {
  private readonly apiUrl = 'http://localhost:3001/api/planes';

  constructor(private readonly http: HttpClient) {}

  getPlanes(): Observable<Plan[]> {
    return this.http.get<Plan[]>(this.apiUrl);
  }
}
