import { Component, OnInit } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { ToastController, AlertController, Platform, LoadingController } from '@ionic/angular';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as JSZip from 'jszip';

@Component({
  selector: 'app-pengaturan',
  templateUrl: './pengaturan.page.html',
  styleUrls: ['./pengaturan.page.scss'],
  standalone: false,
})
export class PengaturanPage implements OnInit {

  constructor(
    private storage: Storage,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private platform: Platform,
    private loadingCtrl: LoadingController
  ) { }

  async ngOnInit() {
    await this.storage.create();
  }

  async backupData() {
    const backupAlert = await this.alertCtrl.create({
      header: 'Buat Password Backup',
      message: 'Masukkan password untuk mengamankan data ini.',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Password Backup'
        }
      ],
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { 
          text: 'Backup', 
          handler: async (data) => {
            if (!data.password) {
              this.showToast('Password tidak boleh kosong!');
              return false;
            }
            this.processBackup(data.password);
            return true;
          }
        }
      ]
    });
    await backupAlert.present();
  }

  async processBackup(password: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Mempersiapkan Backup...',
    });
    await loading.present();

    try {
      const items = await this.storage.get('items') || [];
      const backupObject = {
        password: password,
        data: items
      };
      
      const zip = new JSZip();
      const dataStr = JSON.stringify(backupObject, null, 2);
      zip.file("data.json", dataStr);
      
      for (const item of items) {
         if (item.foto && !item.foto.startsWith('data:image')) {
            try {
               const photoFile = await Filesystem.readFile({
                  path: item.foto,
                  directory: Directory.Data
               });
               zip.file(item.foto, photoFile.data, {base64: true});
            } catch(e) {
               console.warn("Gagal membaca foto untuk backup", item.foto);
            }
         }
      }

      loading.message = 'Membuat file ZIP...';
      const zipBase64 = await zip.generateAsync({type: "base64"});
      const fileName = `MyWarung_Backup_${new Date().getTime()}.zip`;

      if (this.platform.is('capacitor')) {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: zipBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Simpan Backup MyWarung',
          text: 'Pilih lokasi untuk menyimpan file ZIP backup.',
          url: savedFile.uri,
          dialogTitle: 'Simpan ke...'
        });
        this.showToast('Silahkan pilih lokasi backup Anda.');
      } else {
        const zipBlob = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('File backup berhasil diunduh.');
      }
    } catch (error) {
      console.error(error);
      this.showToast('Gagal melakukan backup data.');
    } finally {
      loading.dismiss();
    }
  }

  async restoreData(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const loading = await this.loadingCtrl.create({
      message: 'Membaca file Backup...',
    });
    await loading.present();

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const arrayBuffer = e.target.result;
        const zip = new JSZip();
        
        let loadedZip: JSZip;
        try {
           loadedZip = await zip.loadAsync(arrayBuffer);
        } catch(e) {
           this.showToast('Format file tidak didukung! Harus berupa file ZIP backup dari MyWarung.');
           return;
        }

        const dataJsonFile = loadedZip.file("data.json");
        if (!dataJsonFile) {
            this.showToast('Gagal: File zip tidak memiliki file data.json!');
            return;
        }

        const content = await dataJsonFile.async("string");
        const parsedData = JSON.parse(content);
        
        if (parsedData && parsedData.password !== undefined && Array.isArray(parsedData.data)) {
          this.promptRestorePassword(parsedData.password, parsedData.data, loadedZip);
        } else if (Array.isArray(parsedData)) {
          this.confirmRestoreAction(parsedData, loadedZip);
        } else {
          this.showToast('Format data di dalam zip tidak valid!');
        }
      } catch (error) {
        console.error(error);
        this.showToast('Gagal membaca file. Pastikan zip tersebut benar.');
      } finally {
        loading.dismiss();
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null; // reset input
  }

  async promptRestorePassword(savedPassword: string, itemsData: any[], loadedZip: JSZip) {
    const passwordAlert = await this.alertCtrl.create({
      header: 'Masukkan Password',
      message: 'File backup ini dilindungi password.',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Password Backup'
        }
      ],
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { 
          text: 'Restore', 
          handler: (data) => {
            if (data.password === savedPassword) {
              this.confirmRestoreAction(itemsData, loadedZip);
              return true;
            } else {
              this.showToast('Password salah!');
              return false;
            }
          }
        }
      ]
    });
    await passwordAlert.present();
  }

  async confirmRestoreAction(parsedItems: any[], loadedZip: JSZip) {
    const alert = await this.alertCtrl.create({
      header: 'Konfirmasi Restore',
      message: `Apakah Anda yakin ingin me-restore ${parsedItems.length} data barang? Perhatian: Ini akan menghapus dan menimpa data yang ada saat ini.`,
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { 
          text: 'Restore', 
          handler: async () => {
             const loading = await this.loadingCtrl.create({
                message: 'Memulihkan data (termasuk foto)...'
             });
             await loading.present();

             try {
                // Extract images to the file system
                for (let filename in loadedZip.files) {
                   if (filename !== "data.json" && !loadedZip.files[filename].dir) {
                      const base64Data = await loadedZip.file(filename)!.async("base64");
                      await Filesystem.writeFile({
                         path: filename,
                         data: base64Data,
                         directory: Directory.Data
                      });
                   }
                }
                await this.storage.set('items', parsedItems);
                this.showToast('Data berhasil dipulihkan!');
             } catch(e) {
                console.error(e);
                this.showToast('Terjadi kesalahan parsial saat mengekstrak gambar.');
             } finally {
                loading.dismiss();
             }
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 3500,
      position: 'bottom',
      color: 'dark'
    });
    toast.present();
  }

}

