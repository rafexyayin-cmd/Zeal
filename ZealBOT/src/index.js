import http from "http";
import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";

const token = process.env.DISCORD_TOKEN;
const prefix = "z!";
const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000;

// Cloud Hostlar (Render/Koyeb vb.) için 7/24 Web Sunucusu
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write("ZealBOT 7/24 Aktif!");
  res.end();
}).listen(port, () => {
  console.log(`Web sunucusu ${port} portunda aktif.`);
});

if (!token) {
  console.error(
    "DISCORD_TOKEN bulunamadı. Replit Secrets bölümüne DISCORD_TOKEN olarak bot tokenını ekleyin.",
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const lockedPermissions = {
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
};

const unlockedPermissions = {
  SendMessages: true,
  SendMessagesInThreads: true,
  CreatePublicThreads: true,
  CreatePrivateThreads: true,
};

const helpText = [
  "**ZeaL Bot Komutları**",
  "`z!help` — Komut listesini gösterir.",
  "`z!lock` — Mevcut kanalı kilitler.",
  "`z!unlock` — Mevcut kanalın kilidini açar.",
  "`z!sil <sayı>` — Son mesajları siler. En fazla 100 mesaj.",
  "`z!mute @kullanıcı <süre>` — Kullanıcıyı süreli susturur.",
  "`z!unmute @kullanıcı` — Kullanıcının susturmasını kaldırır.",
  "`z!ban @kullanıcı [sebep]` — Kullanıcıyı sunucudan yasaklar.",
  "",
  "Mute süresi örnekleri: `30s`, `10m`, `2h`, `1d` (en fazla 28 gün).",
].join("\n");

function isSupportedChannel(channel) {
  return (
    channel?.isTextBased() &&
    !channel.isThread() &&
    channel.guild !== undefined &&
    channel.permissionOverwrites !== undefined
  );
}

async function setChannelLock(message, permissions, action) {
  const { channel, guild } = message;

  if (!isSupportedChannel(channel)) {
    await message.reply(
      "Bu komut bir sunucudaki normal yazı veya duyuru kanalında kullanılmalıdır.",
    );
    return;
  }

  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.reply(
      "Bu komutu kullanmak için `Kanalları Yönet` yetkisine sahip olmalısın.",
    );
    return;
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe());
  const botPermissions = botMember.permissionsIn(channel);

  if (!botPermissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.reply(
      "Bu kanalda işlem yapabilmem için `Kanalları Yönet` yetkisine ihtiyacım var.",
    );
    return;
  }

  if (!botPermissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply(
      "Mesajları otomatik silebilmem için `Mesajları Yönet` yetkisine ihtiyacım var.",
    );
    return;
  }

  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone, permissions, {
      reason: `${message.author.tag} tarafından ${prefix}${action} komutu kullanıldı.`,
    });

    const result =
      action === "lock"
        ? "Kanal kilitlendi. `@everyone` için mesaj gönderme ve alt başlık oluşturma izinleri kapatıldı."
        : "Kanalın kilidi açıldı. `@everyone` için mesaj gönderme ve alt başlık oluşturma izinleri açıldı.";

    const confirmation = await message.reply(result);

    await Promise.all([
      confirmation.delete().catch((error) => {
        console.error("Botun onay mesajı silinemedi:", error);
      }),
      message.delete().catch((error) => {
        console.error("Komut mesajı silinemedi:", error);
      }),
    ]);
  } catch (error) {
    console.error(`${action} komutu başarısız oldu:`, error);
    await message.reply(
      "Kanal izinleri değiştirilemedi. Botun rol sırasını ve `Kanalları Yönet` yetkisini kontrol edin.",
    );
  }
}

function parseDuration(value) {
  const match = value?.toLowerCase().match(/^(\d+(?:\.\d+)?)(s|sn|m|dk|h|sa|d|g)$/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs = {
    s: 1000,
    sn: 1000,
    m: 60 * 1000,
    dk: 60 * 1000,
    h: 60 * 60 * 1000,
    sa: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    g: 24 * 60 * 60 * 1000,
  }[unit];

  const durationMs = Math.floor(amount * unitMs);
  return durationMs > 0 && durationMs <= maxTimeoutMs ? durationMs : null;
}

function getMentionedMember(message) {
  return message.mentions.members.first() ?? null;
}

async function fetchMentionedMember(message) {
  const mentionedMember = getMentionedMember(message);
  if (!mentionedMember) {
    return null;
  }

  return message.guild.members
    .fetch(mentionedMember.id)
    .catch(() => mentionedMember);
}

function getMemberActionError(target, botMember) {
  if (target.id === target.guild.ownerId) {
    return "Sunucu sahibi timeout veya ban işlemine tabi tutulamaz.";
  }

  if (target.id === botMember.id) {
    return "Bot kendisine bu işlemi uygulayamaz.";
  }

  if (
    target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0
  ) {
    return "Botun rolü hedef kullanıcının en yüksek rolünden daha yukarıda olmalı.";
  }

  return null;
}

async function muteMember(message, args) {
  const { guild } = message;

  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply(
      "Bu komutu kullanmak için `Üyeleri Zaman Aşımına Uğrat` yetkisine sahip olmalısın.",
    );
    return;
  }

  const target = await fetchMentionedMember(message);
  if (!target) {
    await message.reply("Kullanım: `z!mute @kullanıcı <süre>` (örnek: `z!mute @Ali 10m`)");
    return;
  }

  const durationMs = parseDuration(args[1]);
  if (!durationMs) {
    await message.reply(
      "Geçerli bir süre yazmalısın. Örnekler: `30s`, `10m`, `2h`, `1d`. En fazla 28 gün olabilir.",
    );
    return;
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe());

  if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply(
      "Beni susturabilmem için bu sunucuda `Üyeleri Zaman Aşımına Uğrat` yetkisine sahip olmam gerekiyor.",
    );
    return;
  }

  const actionError = getMemberActionError(target, botMember);
  if (actionError || !target.manageable) {
    await message.reply(
      actionError ??
        "Bu kullanıcı susturulamıyor. Botun `Üyeleri Zaman Aşımına Uğrat` yetkisini ve rol sırasını kontrol edin.",
    );
    return;
  }

  try {
    const reason = `${message.author.tag} tarafından z!mute komutu kullanıldı.`;
    await target.timeout(durationMs, reason);
    await message.reply(`${target.user.tag} ${args[1]} süreyle susturuldu.`);
  } catch (error) {
    console.error("mute komutu başarısız oldu:", error);
    if (error.code === 50013) {
      if (target.permissions.has(PermissionFlagsBits.Administrator)) {
        await message.reply(
          "Bu kullanıcıda `Administrator` yetkisi var. Discord, botun Administrator yetkisi olsa bile Administrator üyelerine timeout uygulanmasına izin vermiyor.",
        );
        return;
      }

      if (target.id === guild.ownerId) {
        await message.reply("Discord, sunucu sahibine timeout uygulanmasına izin vermiyor.");
        return;
      }

      if (
        target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0
      ) {
        await message.reply(
          "Discord, hedef kullanıcının rolü botun rolüne eşit veya daha yüksek olduğu için timeout işlemini reddetti.",
        );
        return;
      }

      await message.reply(
        "Discord timeout işlemini reddetti. Botun sunucudaki gerçek yetkilerini ve hedef kullanıcının rol sırasını kontrol edin.",
      );
      return;
    }
    await message.reply(
      "Kullanıcı susturulamadı. Botun yetkilerini ve rol sırasını kontrol edin.",
    );
  }
}

async function unmuteMember(message) {
  const { guild } = message;

  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply(
      "Bu komutu kullanmak için `Üyelere Zaman Aşımı Uygula` yetkisine sahip olmalısın.",
    );
    return;
  }

  const target = await fetchMentionedMember(message);
  if (!target) {
    await message.reply("Kullanım: `z!unmute @kullanıcı`");
    return;
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe());
  if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply(
      "Beni susturmayı kaldırabilmem için `Üyelere Zaman Aşımı Uygula` yetkisine ihtiyacım var.",
    );
    return;
  }

  const actionError = getMemberActionError(target, botMember);
  if (actionError || !target.manageable) {
    await message.reply(
      actionError ??
        "Bu kullanıcının susturmasını kaldıramıyorum. Botun yetkisini ve rol sırasını kontrol edin.",
    );
    return;
  }

  if (!target.isCommunicationDisabled()) {
    await message.reply(`${target.user.tag} şu anda susturulmuş değil.`);
    return;
  }

  try {
    const reason = `${message.author.tag} tarafından z!unmute komutu kullanıldı.`;
    await target.timeout(null, reason);
    await message.reply(`${target.user.tag} kullanıcısının muteyi kaldırıldı.`);
  } catch (error) {
    console.error("unmute komutu başarısız oldu:", error);
    if (error.code === 50013) {
      await message.reply(
        "Discord mute kaldırma işlemini reddetti. Hedef kullanıcının sunucu sahibi olmadığını ve rolünün bot rolünün altında olduğunu kontrol edin.",
      );
      return;
    }
    await message.reply(
      "Kullanıcının muteyi kaldırılamadı. Botun yetkilerini ve rol sırasını kontrol edin.",
    );
  }
}

async function banMember(message, args) {
  const { guild } = message;

  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply(
      "Bu komutu kullanmak için `Üyeleri Yasakla` yetkisine sahip olmalısın.",
    );
    return;
  }

  const target = await fetchMentionedMember(message);
  if (!target) {
    await message.reply("Kullanım: `z!ban @kullanıcı [sebep]`");
    return;
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe());
  const botPermissions = botMember.permissionsIn(message.channel);

  if (!botPermissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply(
      "Beni yasaklayabilmem için bu sunucuda `Üyeleri Yasakla` yetkisine sahip olmam gerekiyor.",
    );
    return;
  }

  const actionError = getMemberActionError(target, botMember);
  if (actionError || !target.bannable) {
    await message.reply(
      actionError ??
        "Bu kullanıcı yasaklanamıyor. Botun `Üyeleri Yasakla` yetkisini ve rol sırasını kontrol edin.",
    );
    return;
  }

  const reason =
    args.slice(1).join(" ").trim().slice(0, 512) || "Sebep belirtilmedi.";

  try {
    await target.ban({
      deleteMessageSeconds: 86400,
      reason,
    });
    await message.reply(`${target.user.tag} sunucudan yasaklandı. Sebep: ${reason}`);
  } catch (error) {
    console.error("ban komutu başarısız oldu:", error);
    await message.reply(
      "Kullanıcı yasaklanamadı. Botun yetkilerini ve rol sırasını kontrol edin.",
    );
  }
}

async function deleteMessages(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply(
      "Bu komutu kullanmak için `Mesajları Yönet` yetkisine sahip olmalısın.",
    );
    return;
  }

  const amount = Number(args[0]);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    await message.reply("Kullanım: `z!sil <sayı>` (1 ile 100 arasında bir sayı yazın.)");
    return;
  }

  const botMember =
    message.guild.members.me ?? (await message.guild.members.fetchMe());
  if (
    !botMember
      .permissionsIn(message.channel)
      .has(PermissionFlagsBits.ManageMessages)
  ) {
    await message.reply(
      "Mesajları silebilmem için bu kanalda `Mesajları Yönet` yetkisine ihtiyacım var.",
    );
    return;
  }

  if (typeof message.channel.bulkDelete !== "function") {
    await message.reply("Bu kanalda toplu mesaj silme işlemi desteklenmiyor.");
    return;
  }

  try {
    const deleted = await message.channel.bulkDelete(amount, true);
    const confirmation = await message.channel.send(
      `${deleted.size} mesaj silindi.`,
    );

    setTimeout(() => {
      confirmation.delete().catch((error) => {
        console.error("Silme onay mesajı silinemedi:", error);
      });
    }, 3000);
  } catch (error) {
    console.error("sil komutu başarısız oldu:", error);
    await message.reply(
      "Mesajlar silinemedi. Botun `Mesajları Yönet` yetkisini kontrol edin.",
    );
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} olarak giriş yapıldı.`);
  console.log(`${readyClient.guilds.cache.size} sunucuda aktif.`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) {
    return;
  }

  const parts = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = parts.shift()?.toLowerCase();

  if (command === "lock") {
    await setChannelLock(message, lockedPermissions, "lock");
  } else if (command === "unlock") {
    await setChannelLock(message, unlockedPermissions, "unlock");
  } else if (command === "mute") {
    await muteMember(message, parts);
  } else if (command === "unmute") {
    await unmuteMember(message);
  } else if (command === "ban") {
    await banMember(message, parts);
  } else if (command === "sil") {
    await deleteMessages(message, parts);
  } else if (command === "help") {
    await message.reply(helpText);
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord istemci hatası:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("İşlenmeyen hata:", error);
});

client.login(token);