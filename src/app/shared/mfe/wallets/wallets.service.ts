import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WalletsService {
  public provider = new BehaviorSubject<any | undefined>(undefined);
  public account = new BehaviorSubject<{ account: string } | undefined>(
    undefined
  );
}
