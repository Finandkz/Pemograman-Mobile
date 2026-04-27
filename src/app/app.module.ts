import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy, Animation, createAnimation } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

export const fadeAnimation = (baseEl: HTMLElement, opts?: any): Animation => {
  const enteringAnimation = createAnimation()
    .addElement(opts.enteringEl)
    .fromTo('opacity', 0, 1)
    .duration(300);

  const leavingAnimation = createAnimation()
    .addElement(opts.leavingEl)
    .fromTo('opacity', 1, 0)
    .duration(300);

  return createAnimation()
    .addAnimation([enteringAnimation, leavingAnimation]);
};

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    IonicModule.forRoot({ 
      mode: 'ios',
      navAnimation: fadeAnimation
    }),
    AppRoutingModule,
    IonicStorageModule.forRoot()
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
