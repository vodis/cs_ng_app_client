import {
  Component,
  ViewChild,
  ViewContainerRef,
  ComponentFactoryResolver,
  ComponentRef,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';

@Component({
  selector: 'app-wallets',
  template: `
    <h3>mfe wallets</h3>
    <button (click)="loadMFEComponent()">Load MFE Component</button>
    <div #container></div>
  `,
})
export class WalletsComponent {
  @ViewChild('container', { read: ViewContainerRef })
  containerRef!: ViewContainerRef;

  constructor(private resolver: ComponentFactoryResolver) {}

  async loadMFEComponent() {
    try {
      const m = await loadRemoteModule({
        type: 'manifest',
        remoteName: 'mfe-wallets',
        exposedModule: './WalletsComponent',
      });

      // Clear existing components in the container
      this.containerRef.clear();

      // Access the component type from the loaded module
      const componentType = m.WalletsComponent;

      // Create and attach the MFE component to the container
      const componentFactory =
        this.resolver.resolveComponentFactory(componentType);

      const componentRef: ComponentRef<any> = this.containerRef.createComponent(
        componentFactory,
        undefined,
        this.containerRef.injector
      );
      componentRef.instance.toggleWalletsModal();
    } catch (error) {
      console.error('Error loading MFE component:', error);
    }
  }
}
