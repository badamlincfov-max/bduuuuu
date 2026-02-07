# BSU Chat - Bakı Dövlət Universiteti Tələbə Platforması

## Layihə haqqında
Bakı Dövlət Universitetinin tələbələri üçün 16 fakültəli real-time chat platforması.

## Funksiyalar

### ✅ Hazırda tamamlanmış xüsusiyyətlər:
1. **Qeydiyyat sistemi**
   - +994 formatında nömrə validasiyası
   - @bsu.edu.az email sonluğu
   - 3 random doğrulama sualı (min 2 düzgün cavab tələb olunur)
   - Profil avatar seçimi (kişi/qadın)

2. **16 fakültə üçün qrup chat otaqları**
   - Real-time Socket.IO əlaqəsi
   - Mesajlar RAM-da saxlanılır (restart zamanı silinir)
   - Filtr sözləri avtomatik ulduzlanır

3. **Şəxsi mesajlaşma**
   - 1-ə-1 şəxsi chat
   - Əngəlləmə funksiyası
   - Şikayət sistemi

4. **İstifadəçi profili**
   - Ad, soyad, fakültə, dərəcə, kurs
   - Avatar seçimi
   - Profil redaktəsi

5. **Admin Paneli**
   - Super admin: 618ursamajor618 / majorursa618
   - Bütün istifadəçiləri görüntüləmə və aktiv/deaktiv etmə
   - Filtr sözləri (vergüllə ayrılmış)
   - Qaydalar və Haqqında mətnləri
   - Günün mövzusu
   - 8+ şikayət alan istifadəçilər
   - Alt adminlər yaratma/silmə (yalnız super admin)
   - Mesaj qalma müddəti ayarı (saat)

6. **Mesaj avtomatik silinmə**
   - Qrup mesajları: 48 saat (default)
   - Şəxsi mesajlar: 24 saat (default)
   - Admin panelindən dəyişdirilə bilər

### 📋 Funksional URIs və API Endpoint-ləri:

#### Autentifikasiya
- `GET /` - Ana səhifə (giriş/qeydiyyat)
- `POST /api/auth/register` - İstifadəçi qeydiyyatı
- `POST /api/auth/login` - İstifadəçi girişi
- `POST /api/auth/admin/login` - Admin girişi
- `POST /api/auth/logout` - Çıxış
- `GET /api/auth/verification-questions` - Doğrulama sualları
- `POST /api/auth/verify-answers` - Cavabları yoxla

#### İstifadəçi
- `GET /chat.html` - Chat səhifəsi
- `GET /api/user/profile` - Cari istifadəçi profili
- `POST /api/user/profile` - Profili yenilə
- `GET /api/user/faculty-users` - Fakültə istifadəçiləri
- `GET /api/user/user/:id` - İstifadəçi məlumatları
- `GET /api/user/is-blocked/:userId` - Əngəl yoxlaması
- `GET /api/user/settings` - Qaydalar və haqqında

#### Admin
- `GET /admin.html` - Admin paneli
- `GET /api/admin/users` - Bütün istifadəçilər
- `POST /api/admin/users/:id/toggle-status` - Aktiv/deaktiv
- `GET /api/admin/reported-users` - 8+ şikayət alanlar
- `GET /api/admin/settings` - Bütün parametrlər
- `POST /api/admin/settings/:key` - Parametr yenilə
- `GET /api/admin/sub-admins` - Alt adminlər (super admin)
- `POST /api/admin/sub-admins` - Alt admin yarat (super admin)
- `DELETE /api/admin/sub-admins/:id` - Alt admin sil (super admin)

#### WebSocket Events
- `join` - Fakültə otağına qoşul
- `sendGroupMessage` - Qrup mesajı göndər
- `joinPrivateChat` - Şəxsi chatə qoşul
- `sendPrivateMessage` - Şəxsi mesaj göndər
- `blockUser` - İstifadəçini əngəllə
- `reportUser` - İstifadəçini şikayət et

### ❌ Hələ tətbiq edilməmiş xüsusiyyətlər:
Yox - bütün tələb olunan funksiyalar tamamlanıb.

### 🔄 Tövsiyə olunan növbəti addımlar:
1. **Test və Optimizasiya**
   - Performans testləri
   - Daha çox istifadəçi ilə yük testi
   - UI/UX təkmilləşdirmələri

2. **Əlavə Funksiyalar** (opsional)
   - Mesaj axtarışı
   - Fayl yüklənməsi (şəkil, sənəd)
   - Emoji picker
   - Bildiriş sistemi
   - Online/offline status göstəricisi

3. **Təhlükəsizlik Təkmilləşdirmələri**
   - Rate limiting
   - CSRF qoruması
   - XSS qoruması

## Texnologiyalar

### Backend:
- Node.js + Express
- Socket.IO (real-time)
- PostgreSQL (database)
- bcryptjs (şifrələmə)
- express-session (sessiya)

### Frontend:
- Vanilla JavaScript
- Socket.IO Client
- CSS3 (responsive)

## Data Arxitekturası

### Database Modelləri:
1. **users** - İstifadəçi məlumatları
   - id, email, phone, password, full_name
   - faculty, degree, course, avatar
   - is_active, created_at

2. **admins** - Admin hesabları
   - id, username, password
   - is_super_admin, created_at

3. **blocks** - Əngəllənmiş istifadəçilər
   - blocker_id, blocked_id

4. **reports** - Şikayətlər
   - reporter_id, reported_id

5. **settings** - Sistem parametrləri
   - key, value (filter_words, daily_topic, etc.)

### RAM Yaddaşında:
- **groupMessages** - Qrup mesajları (fakultələrə görə)
- **privateMessages** - Şəxsi mesajlar
- **onlineUsers** - Online istifadəçilər

## İstifadəçi Təlimatı

### Tələbə üçün:
1. Ana səhifədə "Qeydiyyat" tab-ına keçin
2. Tələb olunan məlumatları doldurun (+994 nömrə, @bsu.edu.az email)
3. 3 doğrulama sualına cavab verin (min 2 düzgün)
4. Qeydiyyatdan sonra avtomatik chat səhifəsinə yönləndiriləcəksiniz
5. Fakültə otağında digər tələbələrlə söhbət edin
6. Mesajın üstündə "⋮" işarəsinə klikləyərək şəxsi chat, əngəlləmə və ya şikayət edə bilərsiniz

### Admin üçün:
1. Ana səhifədə "Admin Paneli" tab-ına keçin
2. Super admin: `618ursamajor618` / `majorursa618`
3. Dashboard-dan istədiyiniz bölməyə keçin
4. İstifadəçiləri idarə edin, parametrləri dəyişin

## Deployment

### Platform: Render.com

### Render.com-da Deployment Addımları:

1. **PostgreSQL Database Yaradın**
   - Render dashboard-da "New +" → "PostgreSQL" seçin
   - Database adı: `bsu_chat_db` (və ya istədiyiniz ad)
   - Database yaradıldıqdan sonra "Internal Database URL" kopyalayın

2. **Web Service Yaradın**
   - Render dashboard-da "New +" → "Web Service" seçin
   - GitHub repository seçin: `badamlincfov-max/bduuuuu`
   - Service adı: `bsu-chat` (və ya istədiyiniz ad)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Environment Variables təyin edin**
   ```
   DATABASE_URL = [Addım 1-dən kopyaladığınız Internal Database URL]
   SESSION_SECRET = [təsadüfi güclü açar, məs: openssl rand -base64 32]
   NODE_ENV = production
   ```

4. **Deploy edin**
   - "Create Web Service" düyməsini klikləyin
   - Render avtomatik deploy edəcək (5-10 dəqiqə)

5. **Database Schema İnizializasiya (Avtomatik)**
   - İlk deployment zamanı `initDatabase()` funksiyası avtomatik işləyir
   - Bütün cədvəllər və super admin hesabı yaradılır
   - Super admin: `618ursamajor618` / `majorursa618`

6. **Saytı Yoxlayın**
   - Render sizə URL verəcək: `https://bsu-chat.onrender.com`
   - Admin panel: `https://bsu-chat.onrender.com/admin.html`

### Environment Variables:
```
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret-key
NODE_ENV=production
PORT=3000
```

### Deploy Status: ✅ Hazır

### GitHub Repository
**URL**: https://github.com/badamlincfov-max/bduuuuu

### Son Yeniləmə: 2025-02-07

## Lokal Development

```bash
# Dependencies qur
npm install

# Database URL konfiqurasiya et
# .env faylında DATABASE_URL və SESSION_SECRET təyin et

# Serveri başlat
npm start

# Server http://localhost:3000 ünvanında işləyəcək
```

## Əlaqə
Bu layihə Bakı Dövlət Universiteti tələbələri üçün hazırlanmışdır.
