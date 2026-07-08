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
// ⚙️ CONFIGURAZIONE ID EMBERMC
// ==========================================
const TOKEN = process.env.TOKEN;
const RUOLO_STAFF_ID = "1522011549584064594"; 
const RUOLO_STAFF_DISCORD_ID = "1522011549584064592";
const ROLE_MEMBRO_ID = "1522011549575942195";

const WELCOME_CHANNEL_ID = "1522011550037315807";
const CANALE_REGOLAMENTO_ID = "1522011550221729865";
const CANALE_ANNUNCI_ID = "1522398345124122784"; 
const CANALE_INFORMAZIONI_ID = "1522011550221729868";
const CANALE_GENERALE_ID = "1522011550221729871";

const LINK_STORE = "https://store.embermc.it";

const CATEGORIE_TICKET = {
  "generica": "1522011550833967266", "contestazione": "1522011550833967266", "segnalazione": "1522011550833967266",
  "reset-pass": "1522011550833967267", "transfer": "1522011550833967267", "login": "1522011550833967267",
  "survival": "1522011550833967268", "lifesteal": "1522011550833967268", "bedwars": "1522011550833967268",
  "kitpvp": "1522011550833967268", "oneblock": "1522011550833967268",
  "candidatura": "1522394551271030894", "evento-ticket": "1522394586331349023",
  "domande-comm": "1522394622993629245", "rimborso": "1522394622993629245", "problemi-store": "1522394622993629245"
};

const ticketOwners = new Map();
const ticketAssigned = new Map(); 
const ticketCounts = new Map();
const lastWarns = new Map();
const ecoCoins = new Map();
const ecoDaily = new Map();
const userWarns = new Map(); 
const userTicketHistory = new Map(); 
const userPunizioni = new Map(); 
const statMessaggi = new Map(); 
const statVocale = new Map(); 
const vocaleInizio = new Map(); 
let meseCorrente = new Date().getMonth();

const app = express();
app.get('/', (req, res) => res.send('Bot EmberMC Online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

async function inviaBenvenutoMembro(member) {
  try {
    const role = member.guild.roles.cache.get(ROLE_MEMBRO_ID);
    if (role && !member.roles.cache.has(ROLE_MEMBRO_ID)) {
      await member.roles.add(role);
    }
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const username = member.user.username;
    const serverIconUrl = member.guild.iconURL({ extension: 'png', size: 256 }) || member.user.defaultAvatarURL;

    const frasiWelcome = [
      "il divertimento è appena iniziato... sei pronto a brillare?",
      "un nuovo guerriero è entrato nell'arena! Preparati al meglio.",
      "la leggenda di EmberMC continua... scrivi la tua storia!",
      "unisciti alla community e conquista le nostre modalità!"
    ];
    const fraseScelta = frasiWelcome[Math.floor(Math.random() * frasiWelcome.length)];

    const embedWelcome = new EmbedBuilder()
      .setTitle(`👋 Benvenuto @${username}`)
      .setDescription(`${member}, ${fraseScelta}\n\n📜 Prima di accedere, leggi il <#${CANALE_REGOLAMENTO_ID}>.\n📢 Novità in <#${CANALE_ANNUNCI_ID}>.`)
      .setColor('#ea580c')
      .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
      .setFooter({ text: `EmberMC Network`, iconURL: serverIconUrl })
      .setTimestamp();

    const rowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('📖 Regolamento').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${member.guild.id}/${CANALE_REGOLAMENTO_ID}`),
      new ButtonBuilder().setLabel('🛒 Store').setStyle(ButtonStyle.Link).setURL(LINK_STORE)
    );

    await channel.send({ content: `Benvenuto ${member}!`, embeds: [embedWelcome], components: [rowButtons] });
  } catch (e) {
    console.error("Errore Invio Benvenuto:", e);
  }
}

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

// ==========================================
// 🚀 REGISTRAZIONE COMANDI (CORRETTA)
// ==========================================
const commands = [
  new SlashCommandBuilder().setName('ticket').setDescription('Invia il pannello principale per i ticket (Staff Only)'),
  new SlashCommandBuilder().setName('daily').setDescription('Riscatta i tuoi EmberCoin giornalieri (1-10)'),
  new SlashCommandBuilder().setName('store').setDescription('Mostra il link dello store del server'),
  new SlashCommandBuilder().setName('history-ticket-assegnati').setDescription('Mostra la lista dei tuoi ticket in carico (Staff Only)'),
  new SlashCommandBuilder().setName('top-messaggi').setDescription('Mostra la top 10 dei membri più attivi in chat questo mese'),
  new SlashCommandBuilder().setName('top-vocale').setDescription('Mostra la top 10 dei membri che hanno passato più tempo in vocale questo mese'),
  
  new SlashCommandBuilder().setName('punizioni').setDescription('Mostra lo storico delle punizioni di un player (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da verificare').setRequired(true)),

  new SlashCommandBuilder().setName('warn').setDescription('Assegna un ammonimento a un player (3 warn = 10m mute) (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da ammonire').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo del warn').setRequired(true)),
  
  new SlashCommandBuilder().setName('mute').setDescription('Muta un player per una durata specifica (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da mutare').setRequired(true))
    .addStringOption(opt => opt.setName('durata').setDescription('Durata (es: 10m, 2h)').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo').setRequired(false)),
  
  new SlashCommandBuilder().setName('ban').setDescription('Banna un player dal server (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da bannare').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo del ban').setRequired(true))
    .addStringOption(opt => opt.setName('durata').setDescription('Durata o "-s" per Permanente').setRequired(true)),
  
  new SlashCommandBuilder().setName('history').setDescription('Mostra lo storico economico e ticket di un player (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da verificare').setRequired(true)),

  new SlashCommandBuilder().setName('rename').setDescription('Rinomina il ticket corrente (Staff Only)')
    .addStringOption(opt => opt.setName('nome').setDescription('Nuovo nome').setRequired(true)),
  
  new SlashCommandBuilder().setName('add').setDescription('Aggiungi un utente al ticket (Staff Only)')
    .addUserOption(opt => opt.setName('utente').setDescription('L\'utente da aggiungere al ticket').setRequired(true)),
  
  new SlashCommandBuilder().setName('remove').setDescription('Rimuovi un utente dal ticket (Staff Only)')
    .addUserOption(opt => opt.setName('utente').setDescription('L\'utente da rimuovere dal ticket').setRequired(true)),
  
  new SlashCommandBuilder().setName('claim').setDescription('Prendi in gestione questo ticket (Staff Only)'),
  
  new SlashCommandBuilder().setName('assign').setDescription('Assegna il ticket a un altro staffer (Staff Only)')
    .addUserOption(opt => opt.setName('staffer').setDescription('Lo staffer a cui affidare il ticket').setRequired(true)),
  
  new SlashCommandBuilder().setName('close').setDescription('Chiudi il ticket corrente (Staff Only)')
].map(cmd => cmd.toJSON());

// ==========================================
// 🚀 EVENTI DEL BOT
// ==========================================
client.once('ready', async () => {
  console.log(`Bot avviato come ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandi Slash configurati con successo!');
    
    for (const [_, guild] of client.guilds.cache) {
      const members = await guild.members.fetch();
      for (const [_, member] of members) {
        if (!member.user.bot && !member.roles.cache.has(ROLE_MEMBRO_ID)) {
          await inviaBenvenutoMembro(member);
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
  
  setInterval(() => {
    checkTicketInactivity();
    checkMonthlyReset();
  }, 60000);
});

function checkMonthlyReset() {
  const meseAttuale = new Date().getMonth();
  if (meseAttuale !== meseCorrente) {
    statMessaggi.clear();
    statVocale.clear();
    meseCorrente = meseAttuale;
  }
}

client.on('messageCreate', (message) => {
  if (message.author.bot || !message.guild) return;
  const current = statMessaggi.get(message.author.id) || 0;
  statMessaggi.set(message.author.id, current + 1);
});

client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.member?.user.bot) return;
  const userId = newState.id;
  if (!oldState.channelId && newState.channelId) {
    vocaleInizio.set(userId, Date.now());
  }
  if (oldState.channelId && !newState.channelId) {
    const inizio = vocaleInizio.get(userId);
    if (inizio) {
      const tempoPassato = Date.now() - inizio;
      const accumulato = statVocale.get(userId) || 0;
      statVocale.set(userId, accumulato + tempoPassato);
      vocaleInizio.delete(userId);
    }
  }
});

client.on('guildMemberAdd', async (member) => {
  await inviaBenvenutoMembro(member);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;

  const memberRoles = interaction.member?.roles?.cache;
  const isStaff = memberRoles?.has(RUOLO_STAFF_ID) || 
                  memberRoles?.has(RUOLO_STAFF_DISCORD_ID) || 
                  interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (interaction.isChatInputCommand()) {
    const { commandName, options, channel, user, guild } = interaction;

    const publicCommands = ['daily', 'store', 'top-messaggi', 'top-vocale'];
    if (!publicCommands.includes(commandName) && !isStaff) {
      return interaction.reply({ content: '❌ Comando riservato esclusivamente allo Staff ed allo Staff Discord.', ephemeral: true });
    }

    if (commandName === 'store') return interaction.reply({ content: `🛒 Visita lo Store Ufficiale: ${LINK_STORE}`, ephemeral: true });

    if (commandName === 'daily') {
      const lastDaily = ecoDaily.get(user.id) || 0;
      const now = Date.now();
      if (now - lastDaily < 86400000) return interaction.reply({ content: `⏳ Puoi riscuoterlo una volta al giorno!`, ephemeral: true });
      const casuale = Math.floor(Math.random() * 10) + 1;
      ecoCoins.set(user.id, (ecoCoins.get(user.id) || 0) + casuale);
      ecoDaily.set(user.id, now);
      return interaction.reply({ content: `🪙 Hai ottenuto **${casuale} EmberCoin**!` });
    }

    if (commandName === 'top-messaggi') {
      const sorted = [...statMessaggi.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (sorted.length === 0) return interaction.reply({ content: "Nessun dato registrato per questo mese." });
      let str = sorted.map((entry, index) => `${index + 1}. <@${entry[0]}> - **${entry[1]}** messaggi`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🏆 TOP 10 CHAT MENSILE").setDescription(str).setColor("#ea580c")] });
    }

    if (commandName === 'top-vocale') {
      const sorted = [...statVocale.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (sorted.length === 0) return interaction.reply({ content: "Nessun dato registrato per questo mese." });
      let str = sorted.map((entry, index) => {
        const min = Math.floor(entry[1] / 60000);
        return `${index + 1}. <@${entry[0]}> - **${min}** minuti`;
      }).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🏆 TOP 10 VOCALE MENSILE").setDescription(str).setColor("#ea580c")] });
    }

    if (commandName === 'ticket') {
      const embedPanel = new EmbedBuilder()
        .setTitle('🎫 SUPPORTO EMBERMC')
        .setDescription('Hai bisogno di aiuto? Seleziona una delle categorie qui sotto per aprire un ticket con il nostro staff.')
        .setColor('#ea580c')
        .setFooter({ text: 'EmberMC Tickets' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('click_modalita').setLabel('🎮 Modalità').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('click_account').setLabel('🔑 Account').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('click_generale').setLabel('💬 Generale').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('click_commerciale').setLabel('🛒 Commerciale').setStyle(ButtonStyle.Success)
      );
      
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('click_candidature').setLabel('💼 Candidature').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('click_eventi').setLabel('🎁 Eventi').setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ content: 'Pannello generato.', ephemeral: true });
      return channel.send({ embeds: [embedPanel], components: [row, row2] });
    }

    if (commandName === 'history-ticket-assegnati') {
      const mieiTicket = [];
      for (const [chanId, staffId] of ticketAssigned.entries()) {
        if (staffId === user.id) {
          const chan = guild.channels.cache.get(chanId);
          if (chan) mieiTicket.push(`${chan}`);
        }
      }
      if (mieiTicket.length === 0) return interaction.reply({ content: "Nessun ticket ti è attualmente assegnato.", ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎫 I tuoi Ticket in Carico").setDescription(mieiTicket.join('\n')).setColor("#ea580c")], ephemeral: true });
    }

    if (commandName === 'punizioni') {
      const target = options.getUser('player');
      const list = userPunizioni.get(target.id) || [];
      if (list.length === 0) return interaction.reply({ content: `✅ Nessuna punizione a carico di ${target}.` });
      let text = list.map((p, i) => `\`[${p.tipo.toUpperCase()}]\` Motivo: ${p.motivo} | Durata: ${p.durata}`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🔨 Storico Sanzioni - ${target.username}`).setDescription(text).setColor("#ef4444")] });
    }

    if (commandName === 'warn') {
      const targetUser = options.getUser('player');
      const motivo = options.getString('motivo');
      let current = userWarns.get(targetUser.id) || 0;
      current++; userWarns.set(targetUser.id, current);
      
      const lista = userPunizioni.get(targetUser.id) || [];
      lista.push({ tipo: "warn", motivo: motivo, durata: "N/A" });
      userPunizioni.set(targetUser.id, lista);

      if (current >= 3) {
        userWarns.set(targetUser.id, 0);
        const m = await guild.members.fetch(targetUser.id).catch(() => null);
        if (m) await m.timeout(10 * 60 * 1000, "Auto-Mute per 3 warn");
        return interaction.reply({ content: `⚠️ ${targetUser} sanzionato con il 3° Warn. Scattato il **Mute automatico**!` });
      }
      return interaction.reply({ content: `✅ Ammonito ${targetUser}. (${current}/3).` });
    }

    if (commandName === 'mute') {
      const targetUser = options.getUser('player');
      const durata = options.getString('durata');
      const motivo = options.getString('motivo') || "Non specificato";
      const ms = parseDuration(durata);
      const m = await guild.members.fetch(targetUser.id).catch(() => null);
      if (m && ms) {
        await m.timeout(ms, motivo);
        const lista = userPunizioni.get(targetUser.id) || [];
        lista.push({ tipo: "mute", motivo: motivo, durata: durata });
        userPunizioni.set(targetUser.id, lista);
        return interaction.reply({ content: `🔇 Muto applicato a ${targetUser} per ${durata}.` });
      }
      return interaction.reply({ content: "❌ Impossibile applicare il mute.", ephemeral: true });
    }

    if (commandName === 'ban') {
      const targetUser = options.getUser('player');
      const motivo = options.getString('motivo');
      const durata = options.getString('durata');
      await guild.members.ban(targetUser.id, { reason: motivo });
      const lista = userPunizioni.get(targetUser.id) || [];
      lista.push({ tipo: "ban", motivo: motivo, durata: durata });
      userPunizioni.set(targetUser.id, lista);
      return interaction.reply({ content: `🔴 Ban eseguito su ${targetUser.username}. Durata: ${durata}` });
    }

    if (commandName === 'history') {
      const targetUser = options.getUser('player');
      const coins = ecoCoins.get(targetUser.id) || 0;
      const warnCount = userWarns.get(targetUser.id) || 0;
      const historyList = userTicketHistory.get(targetUser.id) || [];
      let ticketText = historyList.length > 0 
        ? historyList.map((t, idx) => `${idx + 1}. \`[${t.data}]\` Categoria: **${t.categoria.toUpperCase()}**`).join('\n')
        : "Nessun ticket registrato.";

      return interaction.reply({ embeds: [
        new EmbedBuilder().setTitle(`📊 Storico Player - @${targetUser.username}`).setColor('#ea580c').addFields(
          { name: '🪙 Bilancio', value: `**${coins} EmberCoins**`, inline: true },
          { name: '⚠️ Warn', value: `**${warnCount}/3**`, inline: true },
          { name: '🎫 Registro Ticket', value: ticketText }
        )
      ]});
    }

    if (commandName === 'rename') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Solo nei ticket.', ephemeral: true });
      const nuovoNome = options.getString('nome').toLowerCase().replace(/\s+/g, '-');
      await channel.setName(`ticket-${nuovoNome}`);
      return interaction.reply({ content: `📝 Ticket rinominato in: \`ticket-${nuovoNome}\`` });
    }

    if (commandName === 'add') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Solo nei ticket.', ephemeral: true });
      const target = options.getUser('utente');
      await channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true });
      return interaction.reply({ content: `➕ ${target} aggiunto.` });
    }

    if (commandName === 'remove') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Solo nei ticket.', ephemeral: true });
      const target = options.getUser('utente');
      await channel.permissionOverwrites.delete(target.id);
      return interaction.reply({ content: `➖ ${target} rimosso.` });
    }

    if (commandName === 'claim') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Solo nei ticket.', ephemeral: true });
      return interaction.reply({ content: `🔒 Gestito da ${interaction.user}.` });
    }

    if (commandName === 'assign') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Solo nei ticket.', ephemeral: true });
      const staffer = options.getUser('staffer');
      ticketAssigned.set(channel.id, staffer.id);
      return interaction.reply({ content: `📌 Assegnato a: ${staffer}.` });
    }

    if (commandName === 'close') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Solo nei ticket.', ephemeral: true });
      await interaction.reply({ content: '⚠️ Chiusura tra 4 secondi...' });
      setTimeout(async () => {
        ticketOwners.delete(channel.id);
        ticketAssigned.delete(channel.id);
        await channel.delete().catch(() => {});
      }, 4000);
    }
  }

  if (interaction.isButton()) {
    const { customId, user, guild } = interaction;

    if (customId === 'click_modalita') {
      const e = new EmbedBuilder().setTitle('TICKETS - MODALITÀ').setDescription('Seleziona la modalità:').setColor('#2b2d31');
      const r = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('make_survival').setLabel('⭐ Survival').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_lifesteal').setLabel('❤️ Lifesteal').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_bedwars').setLabel('🛏️ Bedwars').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_kitpvp').setLabel('⚔️ Kitpvp').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_oneblock').setLabel('📦 OneBlock').setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ embeds: [e], components: [r], ephemeral: true });
    }
    if (customId === 'click_account') {
      const e = new EmbedBuilder().setTitle('TICKETS - ACCOUNT').setDescription('Seleziona il problema:').setColor('#2b2d31');
      const r = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('make_reset-pass').setLabel('⚙️ Reset Password').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_transfer').setLabel('🔄 Trasferimento').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_login').setLabel('🔑 Problemi Login').setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ embeds: [e], components: [r], ephemeral: true });
    }
    if (customId === 'click_generale') {
      const e = new EmbedBuilder().setTitle('TICKETS - GENERALE').setDescription('Seleziona la richiesta:').setColor('#2b2d31');
      const r = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('make_generica').setLabel('📍 Richiesta Generale').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_contestazione').setLabel('🔨 Contestazione').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_segnalazione').setLabel('⚠️ Segnalazione').setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ embeds: [e], components: [r], ephemeral: true });
    }
    if (customId === 'click_commerciale') {
      const e = new EmbedBuilder().setTitle('TICKETS - COMMERCIALE').setDescription('Seleziona il problema commerciale:').setColor('#2b2d31');
      const r = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('make_domande-comm').setLabel('💬 Domande').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_rimborso').setLabel('💰 Rimborso').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('make_problemi-store').setLabel('🧾 Problemi Store').setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ embeds: [e], components: [r], ephemeral: true });
    }
    if (customId === 'click_candidature') {
      const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_candidatura').setLabel('💼 Apri Candidatura').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ content: 'Apri un ticket per proporti:', components: [r], ephemeral: true });
    }
    if (customId === 'click_eventi') {
      const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('make_evento-ticket').setLabel('🎁 Supporto Eventi').setStyle(ButtonStyle.Secondary));
      return interaction.reply({ content: 'Apri un ticket per l\'evento:', components: [r], ephemeral: true });
    }

    if (customId.startsWith('make_')) {
      await interaction.deferReply({ ephemeral: true });
      const tipoScelto = customId.replace('make_', '');
      const catId = CATEGORIE_TICKET[tipoScelto] || Object.values(CATEGORIE_TICKET)[0];
      let currentCount = ticketCounts.get(tipoScelto) || 0; currentCount++; ticketCounts.set(tipoScelto, currentCount);

      try {
        const ticketChannel = await guild.channels.create({
          name: `ticket-${tipoScelto}-${String(currentCount).padStart(3, '0')}`,
          type: ChannelType.GuildText,
          parent: catId,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: RUOLO_STAFF_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: RUOLO_STAFF_DISCORD_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
          ]
        });
        
        ticketOwners.set(ticketChannel.id, user.id);
        const playerHistory = userTicketHistory.get(user.id) || [];
        playerHistory.push({ categoria: tipoScelto, data: new Date().toLocaleDateString('it-IT') });
        userTicketHistory.set(user.id, playerHistory);

        await ticketChannel.send({ content: `👋 Benvenuto ${user}, lo staff ti aiuterà a breve.\nUsa i comandi staff se necessario.` });
        return interaction.editReply({ content: `✅ Ticket aperto: ${ticketChannel}` });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: '❌ Errore durante la creazione del ticket.' });
      }
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

        const tempoPassato = Date.now() - lastMessage.createdTimestamp;
        if (tempoPassato >= 5 * 60 * 60 * 1000) {
          const lastWarn = lastWarns.get(channel.id);
          if (lastWarn && lastMessage.createdTimestamp <= lastWarn) continue; 

          if (lastMessage.author.bot) continue;
          const member = await guild.members.fetch(lastMessage.author.id).catch(() => null);
          if (!member) continue;

          const hasStaffRole = member.roles.cache.has(RUOLO_STAFF_ID) || member.roles.cache.has(RUOLO_STAFF_DISCORD_ID);
          const ownerId = ticketOwners.get(channel.id);

          if (hasStaffRole) {
            await channel.send(`⚠️ Il ticket necessita di una risposta da parte del player. <@${ownerId || ''}>`);
          } else {
            await channel.send(`⚠️ Il ticket necessita di una risposta da parte dello staff. <@&${RUOLO_STAFF_ID}> o <@&${RUOLO_STAFF_DISCORD_ID}>`);
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
