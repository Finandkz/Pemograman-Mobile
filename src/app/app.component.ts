import { Component, OnInit } from '@angular/core';
import { Platform, ToastController, NavController } from '@ionic/angular';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private lastBackPosition: number = 0;

  constructor(
    private platform: Platform, 
    private toastCtrl: ToastController,
    private router: Router,
    private navCtrl: NavController
  ) {
    this.platform.backButton.subscribeWithPriority(10, async () => {
      const currentUrl = this.router.url;

      if (currentUrl === '/home' || currentUrl === '/') {
        const currentTime = new Date().getTime();
        
        if (currentTime - this.lastBackPosition < 2000) {
          App.exitApp();
        } else {
          const toast = await this.toastCtrl.create({
            message: 'Tekan sekali lagi untuk keluar',
            duration: 2000,
            position: 'bottom'
          });
          await toast.present();
          this.lastBackPosition = currentTime;
        }
      } else if (currentUrl === '/about') {
        this.navCtrl.navigateBack('/pengaturan');
      } else {
        this.navCtrl.navigateBack('/home');
      }
    });
  }

  ngOnInit() {
    setTimeout(() => {
      SplashScreen.hide({
        fadeOutDuration: 600
      });
    }, 300);
  }
}
