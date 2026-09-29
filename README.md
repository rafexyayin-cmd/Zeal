# Discord Moderasyon Botu

Bu bot, mevcut kanalda `@everyone` izinlerini yönetir:

- `z!lock`: Mesaj gönderme, alt başlıklarda mesaj gönderme, herkese açık alt başlık oluşturma ve özel alt başlık oluşturma izinlerini kapatır.
- `z!unlock`: Aynı izinleri açar.
- `z!mute @kullanıcı <süre>`: Kullanıcıyı belirtilen süreyle susturur. Örnek: `z!mute @Ali 10m`.
- `z!unmute @kullanıcı`: Kullanıcının timeout/mute işlemini kaldırır.
- `z!ban @kullanıcı [sebep]`: Kullanıcıyı sunucudan yasaklar. Örnek: `z!ban @Ali spam`.
- `z!sil <sayı>`: Son 1-100 mesajı siler. Örnek: `z!sil 20`.
- `z!help`: Komut listesini gösterir.

Mute süresinde `s`/`sn` saniye, `m`/`dk` dakika, `h`/`sa` saat ve `d`/`g` gün anlamına gelir. Discord timeout sınırı nedeniyle en uzun süre 28 gündür.

## Replit kurulumu

1. Replit Secrets bölümünde `DISCORD_TOKEN` adında bir secret oluşturup Discord bot tokenını ekleyin.
2. Discord Developer Portal → uygulamanız → **Bot** bölümünde **Message Content Intent** seçeneğini açın.
3. Botu sunucuya eklerken `bot` ve `applications.commands` scope'larını kullanın.
4. Bot için en az **View Channel**, **Send Messages**, **Manage Channels**, **Manage Messages**, **Moderate Members** ve **Ban Members** izinlerini verin.
5. Replit'te `Start application` workflow'unu `npm start` komutuyla çalıştırın.

## Discord Developer Portal izinleri

Bot ayarlarında **Privileged Gateway Intents** altındaki **Message Content Intent** açık olmalıdır. Bu bot prefix komutları (`z!`) dinlediği için bu intent gereklidir.

Botun rolü, izinleri düzenleyeceği kanalın `@everyone` overwrite'ını değiştirebilecek şekilde **Manage Channels** ve mesaj silebilmek için **Manage Messages** yetkisine sahip olmalıdır. `z!mute` için **Moderate Members**, `z!ban` için **Ban Members** yetkisi gerekir. Komutu kullanan kişinin de ilgili moderasyon yetkisine sahip olması gerekir.

İzin değişikliği başarılı olduktan sonra botun gönderdiği onay mesajı ve komutu kullanan kişinin `z!lock` veya `z!unlock` mesajı otomatik olarak silinir.

`z!mute` komutunu kullanacak kişinin kendi yetkisinde **Moderate Members / Üyelere Zaman Aşımı Uygula** bulunmalıdır. Sunucu sahibi timeout veya ban işlemine tabi tutulamaz. Discord’un rol hiyerarşisi nedeniyle hedef kullanıcının en yüksek rolü botun en yüksek rolünden yukarıda veya eşit olduğu durumda da timeout uygulanamaz.