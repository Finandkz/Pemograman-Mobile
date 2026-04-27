import { Component, OnInit, ViewChild } from '@angular/core';
import { IonModal, ActionSheetController, Platform } from '@ionic/angular';
import { trigger, style, animate, transition } from '@angular/animations';
import { Storage } from '@ionic/storage-angular';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ 
          opacity: 0, 
          transform: 'scale(0)'
        }))
      ])
    ])
  ]
})
export class HomePage implements OnInit {
  @ViewChild(IonModal) modal!: IonModal;

  items: any[] = [];
  displayItems: any[] = [];
  filterTimeout: any;
  searchTerm: string = '';
  selectedCategory: string = 'Semua';

  applyFilter(isCategoryChange = false) {
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }

    const doFilter = () => {
      let filtered = this.items;

      if (this.selectedCategory !== 'Semua') {
        filtered = filtered.filter(item => item.kategori === this.selectedCategory);
      }

      if (this.searchTerm) {
        filtered = filtered.filter(item =>
          item.nama.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      }

      this.displayItems = filtered;
    };

    if (isCategoryChange) {
      this.displayItems = [];
      this.filterTimeout = setTimeout(() => {
        doFilter();
      }, 200);
    } else {
      doFilter();
    }
  }

  onSearchChange() {
    this.applyFilter(false);
  }

  setCategory(category: string) {
    if (this.selectedCategory === category) return;
    this.selectedCategory = category;
    this.applyFilter(true);
  }

  newItem: any = {
    nama: '',
    kategori: '',
    harga: null,
    foto: ''
  };

  editIndex: number | null = null;

  constructor(private actionSheetCtrl: ActionSheetController, private storage: Storage, private platform: Platform) {
    this.init();
  }

  async init() {
    await this.storage.create();
    await this.loadItems();
  }

  async ionViewWillEnter() {
    // Dikosongkan sesuai permintaan agar tidak refresh otomatis
    // Refresh kini murni hanya menggunakan pull-to-refresh
  }

  async loadItems() {
    const storedItems = await this.storage.get('items');
    if (storedItems) {
      for (let item of storedItems) {
        item.displayFoto = await this.getDisplayUrl(item.foto);
      }
      this.items = storedItems;
    } else {
      this.items = [];
    }
    this.applyFilter(false);
  }

  async getDisplayUrl(foto: string): Promise<string> {
    if (!foto) return '';
    // if it's already an old base64 record
    if (foto.startsWith('data:image')) return foto;
    
    try {
      if (Capacitor.isNativePlatform()) {
         const stat = await Filesystem.getUri({ path: foto, directory: Directory.Data });
         return Capacitor.convertFileSrc(stat.uri);
      } else {
         const file = await Filesystem.readFile({ path: foto, directory: Directory.Data });
         return `data:image/jpeg;base64,${file.data}`;
      }
    } catch(e) {
      return foto; 
    }
  }

  ngOnInit() {}

  async handleRefresh(event: any) {
    await this.loadItems();
    setTimeout(() => {
      event.target.complete();
    }, 500);
  }

  onIonInfinite(event: any) {
    setTimeout(() => {
      event.target.complete();
      event.target.disabled = true;
    }, 500);
  }

  async presentActionSheet(item: any, index: number) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: item.nama,
      mode: 'ios',
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.items.splice(index, 1);
            this.saveData();
            this.applyFilter(false);
          }
        },
        {
          text: 'Edit',
          handler: () => {
            this.editIndex = index;
            this.newItem = { ...item };
            this.modal.present();
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  dismissModal() {
    this.modal.dismiss();
    this.resetForm();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        const base64Data = e.target.result as string;
        try {
          const timestamp = new Date().getTime();
          const fileName = `img_${timestamp}.jpeg`;
          const base64Content = base64Data.split(',')[1];
          
          await Filesystem.writeFile({
            path: fileName,
            data: base64Content,
            directory: Directory.Data
          });
          
          this.newItem.foto = fileName;
          this.newItem.displayFoto = await this.getDisplayUrl(fileName);
        } catch(error) {
           console.error("Failed to save image, fallback to base64", error);
           this.newItem.foto = base64Data;
           this.newItem.displayFoto = base64Data;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  simpanBarang() {
    if (this.newItem.nama && this.newItem.harga && this.newItem.kategori) {
      if (this.editIndex !== null) {
        this.items[this.editIndex] = { ...this.newItem };
      } else {
        this.items.push({
          nama: this.newItem.nama,
          kategori: this.newItem.kategori,
          harga: this.newItem.harga,
          foto: this.newItem.foto,
          displayFoto: this.newItem.displayFoto
        });
      }
      this.saveData();
      this.applyFilter(false);
      this.dismissModal();
    }
  }

  async saveData() {
    // Extract everything except displayFoto to avoid bloating memory DB
    const itemsToSave = this.items.map(item => {
      const { displayFoto, ...rest } = item;
      return rest;
    });
    await this.storage.set('items', itemsToSave);
  }

  resetForm() {
    this.newItem = {
      nama: '',
      kategori: '',
      harga: null,
      foto: '',
      displayFoto: ''
    };
    this.editIndex = null;
  }
}
