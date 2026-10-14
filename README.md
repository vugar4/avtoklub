# Avtoklub

Avtoklub üçün yerli Next.js layihəsi. Məhsul tələbləri və dizayn hələ dəqiqləşdirilir; hazırkı səhifə yalnız başlanğıc skeletidir.

## Yerli iş

```powershell
npm.cmd install
npm.cmd run dev
```

`http://localhost:3000` ünvanında yoxlayın. Kod yoxlamaları:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

## Hostinger yayımı

Hədəf: Hostinger Cloud Startup, `peachpuff-crab-388123.hostingersite.com`.

GitHub-dakı `main` budağı iş üçündür. Hostinger yalnız `production` budağına bağlanmalıdır. Beləliklə, yerli iş və `main`-ə göndərilən dəyişikliklər canlı saytı dəyişmir. İstifadəçi yayımı istəyəndə `scripts/publish.ps1` yoxlamaları keçirib həmin təsdiqlənmiş commit-i `production` budağına göndərir. Hostinger GitHub inteqrasiyası bu budaqdakı hər push-u avtomatik qurub yayımlayır.

Hostinger panelində bir dəfə **Web App → Import Git Repository** yolu ilə özəl `globalsefcaremmc-bit/avtoklub` repozitoriyasını və `production` budağını seçmək lazımdır. Framework `Next.js`, Node.js `22.x`, kök qovluq `.`, build əmri `npm run build`, start əmri `npm run start` olmalıdır. Paneldə GitHub hesabının əlaqələndirilməsi tələb oluna bilər. Bu ilkin qoşulmadan sonra ZIP yükləməyə ehtiyac qalmır.

Yayım əmri yalnız istifadəçi canlı saytı yeniləməyi istədikdə işlədilir:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1
```

Əmr təmiz Git vəziyyəti, `main` budağı, GitHub ilə eyni commit, lint, TypeScript və production build tələb edir. Uğurlu push yayımın tamamlandığı demək deyil; Hostinger build statusu və canlı səhifə ayrıca yoxlanmalıdır.

Heç bir parol və API açarı repozitoriyaya əlavə edilməməlidir. Gələcək məxfi dəyişənlər Hostinger panelində saxlanmalıdır.
