const { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  REST, 
  Routes,
  SlashCommandBuilder
} = require('discord.js');
const express = require('express');

// ==========================================
// ⚙️ DATI PRE-CONFIGURATI EMBERMC
// ==========================================
const TOKEN = process.env.TOKEN;
const RUOLO_STAFF_ID = "1522011549584064594"; 

const WELCOME_CHANNEL_ID = "1522011550037315807";
const CANALE_REGOLAMENTO_ID = "1522011550221729865";
const CANALE_ANNUNCI_ID = "1522011550037315812";
const CANALE_INFORMAZIONI_ID = "1522011550221729868";
const CANALE_GENERALE_ID = "1522011550221729871";

const LINK_STORE = "https://store.embermc.it";

const CATEGORIE_TICKET = {
  "generica": "1522011550833967266",
  "contestazione": "1522011550833967266",
  "segnalazione": "1522011550833967266",
  "reset-pass": "1522011550833967267",
  "transfer": "1522011550833967267",
  "login": "1522011550833967267",
  "survival": "1522011550833967268",
  "lifesteal": "1522011550833967268",
  "bedwars": "1522011550833967268",
  "kitpvp": "1522011550833967268",
  "oneblock": "1522011550833967268",
  "candidatura": "1522394551271030894",
  "evento-ticket": "1522394586331349023",
  "domande-comm": "1522394622993629245",
  "rimborso": "1522394622993629245",
  "problemi-store": "1522394622993629245"
};

// Memorie temporanee
const ticketOwners = new Map();
const ticketCounts = new Map();
const lastWarns = new Map();
const ecoCoins = new Map();
const ecoDaily = new Map();

// Nuove memorie per Moderazione e Storico Ticket
const userWarns = new Map(); 
const userTicketHistory = new Map(); 
// ==========================================

const app = express();
app.get('/', (req, res) => res.send('Bot EmberMC Online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Helper per convertire stringhe di tempo (es. 10m, 2h, 1d) in millisecondi
function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([mhdd])$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

const commands = [
  new SlashCommandBuilder().setName('ticket').setDescription('Invia il pannello principale per i ticket (Solo Staff)'),
  new SlashCommandBuilder().setName('daily').setDescription('Riscatta i tuoi EmberCoin giornalieri (1-10)'),
  new SlashCommandBuilder().setName('store').setDescription('Mostra il link dello store del server'),
  
  // COMANDI DI MODERAZIONE AGGIUNTI
  new SlashCommandBuilder().setName('warn').setDescription('Assegna un ammonimento a un player (3 warn = 10m mute) (Solo Staff)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da ammonire').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo del warn').setRequired(true)),
  
  new SlashCommandBuilder().setName('mute').setDescription('Muta un player per una durata specifica (Solo Staff)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da mutare').setRequired(true))
    .addStringOption(opt => opt.setName('durata').setDescription('Durata (es: 10m, 2h, 1d)').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo del mute').setRequired(false)),
  
  new SlashCommandBuilder().setName('ban').setDescription('Banna un player dal server (Solo Staff)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da bannare').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo del ban').setRequired(true))
    .addStringOption(opt => opt.setName('durata').setDescription('Durata (es: 7d) o inserisci "-s" per Permanente').setRequired(true)),
  
  // COMANDO HISTORY AGGIUNTO
  new SlashCommandBuilder().setName('history').setDescription('Mostra lo storico dei ticket aperti e la situazione economica di un player (Solo Staff)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player di cui verificare lo storico').setRequired(true)),

  new SlashCommandBuilder().setName('tag')
    .setDescription('Mostra i requisiti richiesti (Solo Staff)')
    .addStringOption(opt => opt.setName('tipo').setDescription('Tipo di requisiti').setRequired(true)
      .addChoices(
        { name: 'Media', value: 'media' },
        { name: 'Staff', value: 'staff' },
        { name: 'Builder', value: 'builder' }
      )),
  new SlashCommandBuilder().setName('testo')
    .setDescription('Fai scrivere un messaggio al bot (Solo Staff)')
    .addStringOption(opt => opt.setName('messaggio').setDescription('Testo da inviare').setRequired(true)),
  new SlashCommandBuilder().setName('add')
    .setDescription('Aggiungi un utente al ticket (Solo Staff)')
    .addUserOption(opt => opt.setName('utente').setDescription('Utente da aggiungere').setRequired(true)),
  new SlashCommandBuilder().setName('remove')
    .setDescription('Rimuovi un utente dal ticket (Solo Staff)')
    .addUserOption(opt => opt.setName('utente').setDescription('Utente da rimuovere').setRequired(true)),
  new SlashCommandBuilder().setName('claim').setDescription('Prendi in gestione questo ticket (Solo Staff)'),
  new SlashCommandBuilder().setName('assign')
    .setDescription('Assegna il ticket a un altro staffer (Solo Staff)')
    .addUserOption(opt => opt.setName('staffer').setDescription('Lo staffer a cui assegnare il ticket').setRequired(true)),
  new SlashCommandBuilder().setName('close').setDescription('Chiudi il ticket corrente (Solo Staff)')
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  console.log(`Bot avviato come ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandi Slash registrati con successo!');
  } catch (error) {
    console.error(error);
  }
  setInterval(checkTicketInactivity, 60000);
});

// 🎉 MESSAGGIO DI BENVENUTO STRUTTURATO AD EMBED
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const username = member.user.username;
  const serverIconUrl = member.guild.iconURL({ extension: 'png', size: 256 }) || member.user.defaultAvatarURL;

  const frasiWelcome = [
    "il divertimento è appena iniziato... sei pronto a brillare?",
    "un nuovo guerriero è entrato nell'arena! Preparati al meglio.",
    "la leggenda di EmberMC continua... scrivi la tua storia!",
    "unisciti alla community e conquista le nostre modalità!",
    "il fuoco di EmberMC si fa più forte con te a bordo!",
    "prepara le armi, l'avventura della tua vita comincia ora!"
  ];
  const fraseScelta = frasiWelcome[Math.floor(Math.random() * frasiWelcome.length)];

  const embedWelcome = new EmbedBuilder()
    .setTitle(`👋 Benvenuto @${username}`)
    .setDescription(
      `${member}, ${fraseScelta}\n\n` +
      `📜 Prima di accedere ai canali, leggi attentamente il <#${CANALE_REGOLAMENTO_ID}>.\n\n` +
      `📢 Controlla la sezione <#${CANALE_ANNUNCI_ID}> per rimanere aggiornato sulle novità.\n\n` +
      `💼 Scopri come attivare il ruolo PARTNER nella sezione <#${CANALE_INFORMAZIONI_ID}>.\n\n` +
      `💬 Presentati in <#${CANALE_GENERALE_ID}> e conosci persone fantastiche con cui giocare!\n\n` +
      `🛒 Visita il nostro **Store ufficiale**.`
    )
    .setColor('#ea580c')
    .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
    .setFooter({ text: `EmberMC Network`, iconURL: serverIconUrl })
    .setTimestamp();

  const rowButtons1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('📖 Regolamento').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${member.guild.id}/${CANALE_REGOLAMENTO_ID}`),
    new ButtonBuilder().setLabel('📣 Annunci').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${member.guild.id}/${CANALE_ANNUNCI_ID}`),
    new ButtonBuilder().setLabel('💼 Partner').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${member.guild.id}/${CANALE_INFORMAZIONI_ID}`)
  );

  const rowButtons2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('💬 Generale').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${member.guild.id}/${CANALE_GENERALE_ID}`),
    new ButtonBuilder().setLabel('🛒 Store').setStyle(ButtonStyle.Link).setURL(LINK_STORE)
  );

  channel.send({ content: `Benvenuto ${member}!`, embeds: [embedWelcome], components: [rowButtons1, rowButtons2] });
});

// INTERAZIONI COMANDI SLASH E BOTTONI
client.on('interactionCreate', async (interaction) => {
  const isStaff = interaction.member?.roles.cache.has(RUOLO_STAFF_ID) || interaction.member?.permissions.has(PermissionFlagsBits.Administrator);

  if (interaction.isChatInputCommand()) {
    const { commandName, options, channel, user, guild } = interaction;

    const publicCommands = ['daily', 'store'];
    if (!publicCommands.includes(commandName) && !isStaff) {
      return interaction.reply({ content: '❌ Solo i membri dello Staff possono usare questo comando.', ephemeral: true });
    }

    if (commandName === 'store') {
      return interaction.reply({ content: `🛒 Visita il nostro store ufficiale qui: ${LINK_STORE}`, ephemeral: true });
    }

    if (commandName === 'daily') {
      const lastDaily = ecoDaily.get(user.id) || 0;
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;

      if (now - lastDaily < cooldown) {
        const timeLeft = cooldown - (now - lastDaily);
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `⏳ Hai già riscattato il tuo premio oggi! Ritenta tra **${hours}h e ${minutes}m**.`, ephemeral: true });
      }

      const casuale = Math.floor(Math.random() * 10) + 1;
      const attuali = ecoCoins.get(user.id) || 0;
      
      ecoCoins.set(user.id, attuali + casuale);
      ecoDaily.set(user.id, now);

      return interaction.reply({ content: `🪙 Hai ottenuto **${casuale} EmberCoin**! Totale attuale: **${attuali + casuale}**.` });
    }

    // ==========================================
    // 🔨 LOGICA NUOVI COMANDI DI MODERAZIONE
    // ==========================================
    if (commandName === 'warn') {
      const targetUser = options.getUser('player');
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      const motivo = options.getString('motivo');

      if (!targetMember) return interaction.reply({ content: "❌ Impossibile trovare questo player nel server.", ephemeral: true });

      let currentWarns = userWarns.get(targetUser.id) || 0;
      currentWarns++;
      userWarns.set(targetUser.id, currentWarns);

      if (currentWarns >= 3) {
        userWarns.set(targetUser.id, 0); // Resetta i warn dopo la sanzione
        try {
          await targetMember.timeout(10 * 60 * 1000, "Raggiungimento dei 3 ammonimenti (Warn)");
          return interaction.reply({ content: `⚠️ ${targetUser} ha ricevuto il suo 3° Warn. Motivo: **${motivo}**. Scattato il **Mute automatico di 10 minuti**!` });
        } catch (e) {
          return interaction.reply({ content: `⚠️ ${targetUser} ha raggiunto 3 warn (Motivo: ${motivo}) ma non ho i permessi per mutarlo automaticamente.` });
        }
      }

      return interaction.reply({ content: `✅ Ammonito ${targetUser}. Warn attuali: **${currentWarns}/3**. Motivo: ${motivo}` });
    }

    if (commandName === 'mute') {
      const targetUser = options.getUser('player');
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      const durataStr = options.getString('durata');
      const motivo = options.getString('motivo') || "Nessun motivo specificato";

      if (!targetMember) return interaction.reply({ content: "❌ Impossibile trovare questo player nel server.", ephemeral: true });

      const ms = parseDuration(durataStr);
      if (!ms) return interaction.reply({ content: "❌ Durata non valida. Usa formati come `10m`, `2h`, `1d`.", ephemeral: true });

      try {
        await targetMember.timeout(ms, motivo);
        return interaction.reply({ content: `🔇 ${targetUser} è stato mutato per **${durataStr}**. Motivo: **${motivo}**` });
      } catch (e) {
        return interaction.reply({ content: "❌ Errore: Assicurati che il ruolo del bot sia gerarchicamente più alto dell'utente che vuoi mutare.", ephemeral: true });
      }
    }

    if (commandName === 'ban') {
      const targetUser = options.getUser('player');
      const motivo = options.getString('motivo');
      const durataStr = options.getString('durata');

      try {
        if (durataStr.toLowerCase() === '-s') {
          await guild.members.ban(targetUser.id, { reason: `Permanente - ${motivo}` });
          return interaction.reply({ content: `⚡ 🔴 **BAN PERMANENTE** applicato a ${targetUser}. Motivo: **${motivo}**` });
        } else {
          const ms = parseDuration(durataStr);
          if (!ms) return interaction.reply({ content: "❌ Durata non valida. Usa un formato temporale valido o `-s` per un ban permanente.", ephemeral: true });
          
          await guild.members.ban(targetUser.id, { reason: `Temporaneo (${durataStr}) - ${motivo}` });
          
          // Rimuove il ban automaticamente al termine della durata (Ban temporaneo simulato)
          setTimeout(async () => {
            await guild.members.unban(targetUser.id, "Fine durata ban temporaneo").catch(() => {});
          }, ms);

          return interaction.reply({ content: `⏳ 🔴 **BAN TEMPORANEO** applicato a ${targetUser} per **${durataStr}**. Motivo: **${motivo}**` });
        }
      } catch (e) {
        return interaction.reply({ content: "❌ Errore durante l'esecuzione del ban. Verifica i miei permessi di amministrazione.", ephemeral: true });
      }
    }

    // ==========================================
    // 🔍 LOGICA COMANDO HISTORY
    // ==========================================
    if (commandName === 'history') {
      const targetUser = options.getUser('player');
      
      const coins = ecoCoins.get(targetUser.id) || 0;
      const warnCount = userWarns.get(targetUser.id) || 0;
      const historyList = userTicketHistory.get(targetUser.id) || [];

      let ticketText = historyList.length > 0 
        ? historyList.map((t, idx) => `${idx + 1}. \`[${t.data}]\` Categoria: **${t.categoria.toUpperCase()}**`).join('\n')
        : "Nessun ticket registrato nello storico di questa sessione.";

      const embedHistory = new EmbedBuilder()
        .setTitle(`📊 Storico Player - @${targetUser.username}`)
        .setColor('#ea580c')
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '🪙 Bilancio Economia', value: `**${coins} EmberCoins**`, inline: true },
          { name: '⚠️ Ammonimenti (Warn)', value: `**${warnCount}/3**`, inline: true },
          { name: '🎫 Registro Ticket Aperti', value: ticketText }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embedHistory] });
    }

    if (commandName === 'ticket') {
      await interaction.reply({ content: 'Generazione dei pannelli in corso...', ephemeral: true });

      const embedIntro = new EmbedBuilder()
        .setTitle('🛰️ EMBERMC TICKETS')
        .setDescription('Clicca uno dei bottoni di seguito per aprire un ticket in base alla tipologia di supporto desiderata.\n\n*Click one of the buttons below to open a ticket based on the type of support you want.*')
        .setColor('#2b2d31');
      await channel.send({ embeds: [embedIntro] });

      const embedMod = new EmbedBuilder()
        .setTitle('🎮 Modalità (Mode-specific)')
        .setDescription('Per richieste specifiche di supporto per una modalità del Network o per segnalazioni di giocatori o di bug.\n*For in-game mode specific questions or to report players/bugs.*')
        .setColor('#2b2d31');
      const rowMod = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('click_modalita').setLabel('🎮 Seleziona/Select').setStyle(ButtonStyle.Success));
      await channel.send({ embeds: [embedMod], components: [rowMod] });

      const embedAcc = new EmbedBuilder()
        .setTitle('🔑 Account (Account)')
        .setDescription('Per aiuto nella gestione del proprio account, richiedere trasferimenti, reset password, etc.\n*For help with account management, transfers, password resets, etc.*')
        .setColor('#2b2d31');
      const rowAcc = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('click_account').setLabel('🔑 Seleziona/Select').setStyle(ButtonStyle.Primary));
      await channel.send({ embeds: [embedAcc], components: [rowAcc] });

      const embedGen = new EmbedBuilder()
        .setTitle('📝 Generale (General)')
        .setDescription('Per richieste generiche, contestazioni punizioni, segnalazioni utenti o problemi voto. Per richieste specifiche usa il tasto Supporto Modalità.\n*For general questions, contesting punishments, reporting users or voting issues. For mode-specific questions use the Mode Support button.*')
        .setColor('#2b2d31');
      const rowGen = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('click_generale').setLabel('📝 Seleziona/Select').setStyle(ButtonStyle.Secondary));
      await channel.send({ embeds: [embedGen], components: [rowGen] });

      const embedCom = new EmbedBuilder()
        .setTitle('💵 Commerciale (Commercial)')
        .setDescription('Per richiedere supporto generale negli acquisti, recuperare un pacchetto VIP, riscattare la Sub di Twitch oppure richiedere una collaborazione.\n*For general help with purchases, retrieving a VIP package, redeeming the Twitch Sub or requesting a collaboration.*')
        .setColor('#2b2d31');
      const rowCom = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('click_commerciale').setLabel('💵 Seleziona/Select').setStyle(ButtonStyle.Primary));
      await channel.send({ embeds: [embedCom], components: [rowCom] });

      const embedCand = new EmbedBuilder()
        .setTitle('📝 Candidature (Staff Applications)')
        .setDescription('Per richieste di arruolamento nel nostro Staff.\n*To apply for a position in our Staff.*')
        .setColor('#2b2d31');
      const rowCand = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('click_candidature').setLabel('📝 Seleziona/Select').setStyle(ButtonStyle.Secondary));
      await channel.send({ embeds: [embedCand], components: [rowCand] });

      const embedEv = new EmbedBuilder()
        .setTitle('🎉 Eventi (Events)')
        .setDescription('Categoria dedicata agli eventi organizzati da EmberMC.\n*Category dedicated to events organized by EmberMC.*\n\nSei blacklistato? [Compila il form di contestazione](https://google.com)')
        .setColor('#2b2d31');
      const rowEv = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('click_eventi').setLabel('🎉 Seleziona/Select').setStyle(ButtonStyle.Primary));
      await channel.send({ embeds: [embedEv], components: [rowEv] });
      return;
    }

    if (commandName === 'tag') {
      const tipo = options.getString('tipo');
      let testoTag = '';
      if (tipo === 'media') testoTag = '📌 **Requisiti Media**: Almeno 1000 iscritti su YouTube o 500 follower su Twitch con live costanti.';
      if (tipo === 'staff') testoTag = '📌 **Requisiti Staff**: Età minima 16 anni, buona conoscenza del regolamento e disponibilità oraria.';
      if (tipo === 'builder') testoTag = '📌 **Requisiti Builder**: Portfolio dimostrabile e padronanza di WorldEdit.';
      return interaction.reply({ content: testoTag });
    }

    if (commandName === 'testo') {
      const msg = options.getString('messaggio');
      await interaction.reply({ content: 'Inviato!', ephemeral: true });
      return channel.send({ content: msg });
    }

    if (commandName === 'add') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Usa questo comando solo dentro un ticket.', ephemeral: true });
      const target = options.getUser('utente');
      await channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.reply({ content: `➕ ${target} è stato aggiunto al ticket.` });
    }

    if (commandName === 'remove') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Usa questo comando solo dentro un ticket.', ephemeral: true });
      const target = options.getUser('utente');
      await channel.permissionOverwrites.delete(target.id);
      return interaction.reply({ content: `➖ ${target} è stato rimosso dal ticket.` });
    }

    if (commandName === 'claim') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Usa questo comando solo dentro un ticket.', ephemeral: true });
      return interaction.reply({ content: `🔒 Questo ticket è stato preso in gestione da ${interaction.user}.` });
    }

    if (commandName === 'assign') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Usa questo comando solo dentro un ticket.', ephemeral: true });
      const staffer = options.getUser('staffer');
      return interaction.reply({ content: `📌 Ticket assegnato allo staffer: ${staffer}.` });
    }

    if (commandName === 'close') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Usa questo comando solo dentro un ticket.', ephemeral: true });
      await interaction.reply({ content: '⚠️ Il ticket verrà chiuso tra 5 secondi...' });
      setTimeout(async () => {
        ticketOwners.delete(channel.id);
        lastWarns.delete(channel.id);
        await channel.delete().catch(() => {});
      }, 5000);
    }
  }

  if (interaction.isButton()) {
    const { customId, user, guild } = interaction;

    if (customId.startsWith('make_')) {
      await interaction.deferReply({ ephemeral: true });
      const tipoScelto = customId.replace('make_', '');
      
      const categoriaIdDestinazione = CATEGORIE_TICKET[tipoScelto] || Object.values(CATEGORIE_TICKET)[0];

      let currentCount = ticketCounts.get(tipoScelto) || 0;
      currentCount++;
      ticketCounts.set(tipoScelto, currentCount);

      const numeroFormattato = String(currentCount).padStart(3, '0');
      const nomeCanale = `ticket-${tipoScelto}-${numeroFormattato}`;

      try {
        const ticketChannel = await guild.channels.create({
          name: nomeCanale,
          type: ChannelType.GuildText,
          parent: categoriaIdDestinazione,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: RUOLO_STAFF_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
          ]
        });

        ticketOwners.set(ticketChannel.id, user.id);

        // 📝 SALVATAGGIO NELLO STORICO DEL PLAYER
        const playerHistory = userTicketHistory.get(user.id) || [];
        const dataOggi = new Date().toLocaleDateString('it-IT');
        playerHistory.push({ categoria: tipoScelto, data: dataOggi });
        userTicketHistory.set(user.id, playerHistory);

        await ticketChannel.send({
          content: `👋 Benvenuto nel tuo ticket per **${tipoScelto.toUpperCase()}** ${user}, lo <@&${RUOLO_STAFF_ID}> ti assisterà a breve.\nDescrivi pure il tuo problema.`
        });

        return interaction.editReply({ content: `✅ Ticket creato con successo: ${ticketChannel}` });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: '❌ Errore durante la creazione del ticket. Verifica i permessi delle categorie del Bot.' });
      }
    }

    if (customId === 'click_modalita') {
      const embed = new EmbedBuilder().setTitle('EMBERMC TICKETS - MODE').setDescription('Seleziona una categoria di seguito per aprire un ticket in base alla tipologia di supporto desiderata.').setColor('#2b2d31');
      const rowSurvival = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_survival').setLabel('⭐ Survival / Survival').setStyle(ButtonStyle.Secondary));
      const rowLifesteal = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_lifesteal').setLabel('❤️ Lifesteal / Lifesteal').setStyle(ButtonStyle.Secondary));
      const rowBedwars = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_bedwars').setLabel('🛏️ Bedwars / Bedwars').setStyle(ButtonStyle.Secondary));
      const rowKitpvp = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_kitpvp').setLabel('⚔️ Kitpvp / Kitpvp').setStyle(ButtonStyle.Secondary));
      const rowOneblock = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_oneblock').setLabel('📦 OneBlock / OneBlock').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ embeds: [embed], components: [rowSurvival, rowLifesteal, rowBedwars, rowKitpvp, rowOneblock], ephemeral: true });
    }

    if (customId === 'click_account') {
      const embed = new EmbedBuilder().setTitle('EMBERMC TICKETS - ACCOUNT').setDescription('Seleziona una categoria di seguito per aprire un ticket in base alla tipologia di supporto desiderata.').setColor('#2b2d31');
      const r1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_reset-pass').setLabel('⚙️ Richiesta Reset Password').setStyle(ButtonStyle.Secondary));
      const r2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_transfer').setLabel('🔄 Trasferimento Account').setStyle(ButtonStyle.Secondary));
      const r3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_login').setLabel('🔑 Problemi al Login-Register').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ embeds: [embed], components: [r1, r2, r3], ephemeral: true });
    }

    if (customId === 'click_generale') {
      const embed = new EmbedBuilder().setTitle('EMBERMC TICKETS - GENERAL').setDescription('Seleziona una categoria di seguito per aprire un ticket in base alla tipologia di supporto desiderata.').setColor('#2b2d31');
      const r1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_generica').setLabel('📍 Richiesta Generale').setStyle(ButtonStyle.Secondary));
      const r2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_contestazione').setLabel('🔨 Contestazione Infrazione').setStyle(ButtonStyle.Secondary));
      const r3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_segnalazione').setLabel('⚠️ Segnalazione Utente').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ embeds: [embed], components: [r1, r2, r3], ephemeral: true });
    }

    if (customId === 'click_commerciale') {
      const embed = new EmbedBuilder().setTitle('EMBERMC TICKETS - COMMERCIAL').setDescription('Seleziona una categoria di seguito per aprire un ticket in base alla tipologia di supporto desiderata.').setColor('#2b2d31');
      const r1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_domande-comm').setLabel('💬 Domande Commerciali').setStyle(ButtonStyle.Secondary));
      const r2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_rimborso').setLabel('💰 Richiesta Rimborso').setStyle(ButtonStyle.Secondary));
      const r3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_problemi-store').setLabel('🧾 Problemi con lo Store').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ embeds: [embed], components: [r1, r2, r3], ephemeral: true });
    }

    if (customId === 'click_candidature') {
      const embed = new EmbedBuilder().setTitle('EMBERMC TICKETS - CANDIDATURE').setDescription('Seleziona una categoria di seguito per aprire un ticket in base alla tipologia di supporto desiderata.').setColor('#2b2d31');
      const r1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_candidatura').setLabel('💼 Candidature').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ embeds: [embed], components: [r1], ephemeral: true });
    }

    if (customId === 'click_eventi') {
      const embed = new EmbedBuilder().setTitle('EMBERMC TICKETS - EVENTO').setDescription('Seleziona una categoria di seguito per aprire un ticket in base alla tipologia di supporto desiderata.').setColor('#2b2d31');
      const r1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_evento-ticket').setLabel('🎁 Partecipazione Eventi / Event Support').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ embeds: [embed], components: [r1], ephemeral: true });
    }
  }
});

async function checkTicketInactivity() {
  const guilds = client.guilds.cache;
  for (const [_, guild] of guilds) {
    const tutteLeCategorie = Object.values(CATEGORIE_TICKET);
    const ticketChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText && tutteLeCategorie.includes(c.parentId) && c.name.startsWith('ticket-'));

    for (const [_, channel] of ticketChannels) {
      try {
        const messages = await channel.messages.fetch({ limit: 1 });
        const lastMessage = messages.first();
        if (!lastMessage) continue;

        const orarioUltimoMessaggio = lastMessage.createdTimestamp;
        const tempoPassato = Date.now() - orarioUltimoMessaggio;
        const cinqueOre = 5 * 60 * 60 * 1000;

        if (tempoPassato >= cinqueOre) {
          const lastWarn = lastWarns.get(channel.id);
          if (lastWarn && orarioUltimoMessaggio <= lastWarn) continue; 

          const author = lastMessage.author;
          if (author.bot) continue;

          const member = await guild.members.fetch(author.id).catch(() => null);
          if (!member) continue;

          const isStaff = member.roles.cache.has(RUOLO_STAFF_ID) || member.permissions.has(PermissionFlagsBits.Administrator);
          const ownerId = ticketOwners.get(channel.id);

          if (isStaff) {
            await channel.send(`⚠️ Il ticket necessita di una risposta da parte del player. <@${ownerId || ''}>`);
          } else {
            await channel.send(`⚠️ Il ticket necessita di una risposta da parte dello staff. <@&${RUOLO_STAFF_ID}>`);
          }
          lastWarns.set(channel.id, Date.now());
        }
      } catch (err) {
        console.error(err);
      }
    }
  }
}

client.login(TOKEN);
