import {
  Component,
  ViewChild,
  ViewContainerRef,
  ComponentRef,
  OnInit,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';

@Component({
  selector: 'app-wallets',
  standalone: false,
  template: ` <div #container></div> `,
})
export class WalletsComponent implements OnInit {
  @ViewChild('container', { read: ViewContainerRef })
  public containerRef!: ViewContainerRef;

  constructor(private walletsService: WalletsService) {}

  ngOnInit() {
    this.initializeMfe();
  }

  async initializeMfe() {
    try {
      const m = await loadRemoteModule({
        type: 'manifest',
        remoteName: 'mfe-wallets',
        exposedModule: './WalletsComponent',
      });

      this.containerRef.clear();

      const componentType = m.WalletsComponent;

      const componentRef: ComponentRef<any> = this.containerRef.createComponent(
        componentType,
        {
          injector: this.containerRef.injector,
        }
      );

      componentRef.instance.account?.subscribe(
        (account: { account: string }) => {
          this.walletsService.account.next(account);
        }
      );
    } catch (error) {
      console.error('Error loading MFE component:', error);
    }
  }
}
