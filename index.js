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

// 💾 FIX RENDER: Importazione sicura per Enmap v6+
const { Enmap } = require('enmap'); 
const fallbackEnmap = Enmap || require('enmap').default || require('enmap');

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

const LINK_STORE = "https://ember-forge-play.base44.app/";

const CATEGORIE_TICKET = {
  "generica": "1522011550833967266", "contestazione": "1522011550833967266", "segnalazione": "1522011550833967266",
  "reset-pass": "1522011550833967267", "transfer": "1522011550833967267", "login": "1522011550833967267",
  "survival": "1522011550833967268", "lifesteal": "1522011550833967268", "bedwars": "1522011550833967268",
  "kitpvp": "1522011550833967268", "oneblock": "1522011550833967268",
  "candidatura": "1522394551271030894", "evento-ticket": "1522394586331349023",
  "domande-comm": "1522394622993629245", "rimborso": "1522394622993629245", "problemi-store": "1522394622993629245"
};

// ==========================================
// 💾 DATABASE PERSISTENTE E MAPPE TEMPORANEE
// ==========================================
const ecoCoins = new fallbackEnmap({ name: 'ecoCoins' });
const ecoDaily = new fallbackEnmap({ name: 'ecoDaily' });
const userWarns = new fallbackEnmap({ name: 'userWarns' }); 
const userTicketHistory = new fallbackEnmap({ name: 'userTicketHistory' }); 
const userPunizioni = new fallbackEnmap({ name: 'userPunizioni' }); 
const statMessaggi = new fallbackEnmap({ name: 'statMessaggi' }); 
const statVocale = new fallbackEnmap({ name: 'statVocale' }); 
const partnerStats = new fallbackEnmap({ name: 'partnerStats' }); 

const ticketOwners = new Map();
const ticketAssigned = new Map(); 
const ticketCounts = new Map();
const lastWarns = new Map();
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

// ==========================================
// 📊 FUNZIONE AUTOMATICA SERVERSTATS
// ==========================================
async function aggiornaServerStats(guild) {
  try {
    const members = await guild.members.fetch();
    const totaleMembri = members.size;
    const totaleUtenti = members.filter(m => !m.user.bot).size;
    const totaleBot = members.filter(m => m.user.bot).size;

    let categoriaStats = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes("STATISTICHE EMBERMC"));
    if (!categoriaStats) {
      categoriaStats = await guild.channels.create({
        name: "📊 STATISTICHE EMBERMC",
        type: ChannelType.GuildCategory,
        position: 0
      });
    }

    const nomiContatori = [
      { chiave: "📊 Totale Membri:", valore: totaleMembri },
      { chiave: "👤 Utenti:", valore: totaleUtenti },
      { chiave: "🤖 Bot:", valore: totaleBot }
    ];

    for (const contatore of nomiContatori) {
      const nomeCanaleAtteso = `${contatore.chiave} ${contatore.valore}`;
      let canaleContatore = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.parentId === categoriaStats.id && c.name.startsWith(contatore.chiave));
      
      if (!canaleContatore) {
        await guild.channels.create({
          name: nomeCanaleAtteso,
          type: ChannelType.GuildVoice,
          parent: categoriaStats.id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.Connect], 
              allow: [PermissionFlagsBits.ViewChannel] 
            }
          ]
        });
      } else if (canaleContatore.name !== nomeCanaleAtteso) {
        await canaleContatore.setName(nomeCanaleAtteso);
      }
    }
  } catch (error) {
    console.error("Errore nell'aggiornamento di ServerStats:", error);
  }
}

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
// 🚀 REGISTRAZIONE COMANDI
// ==========================================
const commands = [
  new SlashCommandBuilder().setName('ticket').setDescription('Invia il pannello principale per i ticket (Staff Only)'),
  new SlashCommandBuilder().setName('daily').setDescription('Riscatta i tuoi EmberCoin giornalieri (da 1 a 200)'),
  new SlashCommandBuilder().setName('store').setDescription('Mostra il link dello store del server'),
  new SlashCommandBuilder().setName('history-ticket-assegnati').setDescription('Mostra la lista dei tuoi ticket in carico (Staff Only)'),
  new SlashCommandBuilder().setName('top-messaggi').setDescription('Mostra la top 10 dei membri più attivi in chat questo mese'),
  new SlashCommandBuilder().setName('top-vocale').setDescription('Mostra la top 10 dei membri che hanno passato più tempo in vocale questo mese'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Mostra la top 10 dei giocatori con più EmberCoin e la tua posizione'),
  
  new SlashCommandBuilder().setName('compito').setDescription('Assegna un compito a un player (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player a cui assegnare il compito').setRequired(true))
    .addStringOption(opt => opt.setName('descrizione').setDescription('Descrizione del compito').setRequired(true)),
  
  new SlashCommandBuilder().setName('set').setDescription('Imposta il numero di EmberCoin a un player (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da modificare').setRequired(true))
    .addIntegerOption(opt => opt.setName('monete').setDescription('Numero di EmberCoin').setRequired(true)),

  new SlashCommandBuilder().setName('testo').setDescription('Invia un messaggio normale o embed in un canale specifico (Staff Only)')
    .addChannelOption(opt => opt.setName('canale').setDescription('Il canale dove inviare il messaggio').setRequired(true))
    .addStringOption(opt => opt.setName('tipo').setDescription('Scegli se inviare un messaggio normale o un embed').setRequired(true)
      .addChoices({ name: 'Normale', value: 'normale' }, { name: 'Embed', value: 'embed' }))
    .addStringOption(opt => opt.setName('contenuto').setDescription('Il testo del messaggio o la descrizione dell\'embed').setRequired(true))
    .addStringOption(opt => opt.setName('titolo').setDescription('Il titolo (valido solo se scegli Embed)').setRequired(false)),

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
  
  new SlashCommandBuilder().setName('close').setDescription('Chiudi il ticket corrente (Staff Only)'),

  new SlashCommandBuilder().setName('slots').setDescription('Scommetti i tuoi EmberCoin alla slot machine!')
    .addIntegerOption(opt => opt.setName('scommessa').setDescription('Quantità di EmberCoin da scommettere').setRequired(true)),

  new SlashCommandBuilder().setName('userinfo').setDescription('Visualizza le informazioni complete di un player (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player da esaminare').setRequired(true)),

  new SlashCommandBuilder().setName('tag').setDescription('Invia una risposta preimpostata professionale (Staff Only)')
    .addStringOption(opt => opt.setName('nome_tag').setDescription('Seleziona la risposta preimpostata').setRequired(true)
      .addChoices(
        { name: '1. Reset Password', value: 'reset_pass' },
        { name: '2. Problemi Store/Mancato Arrivo', value: 'store_mancato' },
        { name: '3. Segnalazione Cheater (Prove)', value: 'cheat_prove' },
        { name: '4. Richiesta Unban/Unmute', value: 'richiesta_unban' },
        { name: '5. Candidature Staff', value: 'candidature_staff' },
        { name: '6. Candidature Media/Partner', value: 'candidature_media' },
        { name: '7. Segnalazione Bug', value: 'segnalazione_bug' },
        { name: '8. Trasferimento Account (Premium/SP)', value: 'transfer_account' },
        { name: '9. Problemi di Lag/Connessione', value: 'lag_connessione' },
        { name: '10. Furto/Grief nella Survival', value: 'furto_survival' },
        { name: '11. Rimborso Item Persi per Bug', value: 'rimborso_bug' },
        { name: '12. Insulti/Tossicità in Chat', value: 'tossicita_chat' },
        { name: '13. Informazioni sui Provini', value: 'info_provini' },
        { name: '14. Abuso di Potere (Staffer)', value: 'abuso_staff' },
        { name: '15. Bug dello Store (Duplicati)', value: 'store_duplicato' },
        { name: '16. Come Diventare Builder', value: 'info_builder' },
        { name: '17. Problemi Login (IP/Porta)', value: 'problemi_login' },
        { name: '18. Proposte Miglioramento', value: 'proposte_server' },
        { name: '19. Candidatura Eventi/Builder', value: 'candidatura_eventi' },
        { name: '20. Chiusura Ticket Inattivo', value: 'chiusura_inattivo' }
      )),

  new SlashCommandBuilder().setName('partner').setDescription('Gestisci le partnership del network (Staff Only)')
    .addSubcommand(sub => sub.setName('add').setDescription('Registra una nuova partnership')
      .addUserOption(opt => opt.setName('utente').setDescription('Il rappresentante del server partner').setRequired(true))
      .addStringOption(opt => opt.setName('nome').setDescription('Nome del server partner').setRequired(true))
      .addStringOption(opt => opt.setName('link').setDescription('Link d\'invito del partner').setRequired(true)))
    .addSubcommand(sub => sub.setName('stats').setDescription('Mostra le statistiche partnership di un utente')
      .addUserOption(opt => opt.setName('staffer').setDescription('Lo staffer da verificare').setRequired(true)))
    .addSubcommand(sub => sub.setName('verificare').setDescription('Controlla la validità di un link d\'invito partner')
      .addStringOption(opt => opt.setName('link').setDescription('Il link d\'invito da verificare').setRequired(true))),

  new SlashCommandBuilder().setName('regala-coin').setDescription('Regala EmberCoin a un player durante un evento (Staff Only)')
    .addUserOption(opt => opt.setName('player').setDescription('Il player che riceve il premio').setRequired(true))
    .addIntegerOption(opt => opt.setName('monete').setDescription('Numero di EmberCoin da regalare').setRequired(true))
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
      await aggiornaServerStats(guild);
      
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
  await aggiornaServerStats(member.guild);
});

client.on('guildMemberRemove', async (member) => {
  await aggiornaServerStats(member.guild);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;

  const memberRoles = interaction.member?.roles?.cache;
  const isStaff = memberRoles?.has(RUOLO_STAFF_ID) || 
                  memberRoles?.has(RUOLO_STAFF_DISCORD_ID) || 
                  interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (interaction.isChatInputCommand()) {
    const { commandName, options, channel, user, guild } = interaction;

    const publicCommands = ['daily', 'store', 'top-messaggi', 'top-vocale', 'leaderboard', 'slots'];
    if (!publicCommands.includes(commandName) && !isStaff) {
      return interaction.reply({ content: '❌ Comando riservato esclusivamente allo Staff ed allo Staff Discord.', ephemeral: true });
    }

    if (commandName === 'store') return interaction.reply({ content: `🛒 Visita lo Store Ufficiale di EmberMC: ${LINK_STORE}`, ephemeral: true });

    if (commandName === 'daily') {
      const lastDaily = ecoDaily.get(user.id) || 0;
      const now = Date.now();
      
      if (now - lastDaily < 86400000) {
        const tempoRimasto = 86400000 - (now - lastDaily);
        const ore = Math.floor(tempoRimasto / (1000 * 60 * 60));
        const minuti = Math.floor((tempoRimasto % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `⏳ Puoi riscuotere il tuo daily una volta ogni 24 ore! Prova di nuovo tra **${ore} ore e ${minuti} minuti**.`, ephemeral: true });
      }
      
      const casuale = Math.floor(Math.random() * 200) + 1;
      const balance = ecoCoins.get(user.id) || 0;
      ecoCoins.set(user.id, balance + casuale);
      ecoDaily.set(user.id, now);
      return interaction.reply({ content: `🪙 Complimenti! Hai estratto e riscattato **${casuale} EmberCoin** giornalieri!` });
    }

    if (commandName === 'leaderboard') {
      const allCoins = Array.from(ecoCoins.entries());
      const sorted = allCoins.sort((a, b) => b[1] - a[1]);
      const top10 = sorted.slice(0, 10);
      
      let userRank = sorted.findIndex(entry => entry[0] === user.id) + 1;
      let userCoins = ecoCoins.get(user.id) || 0;
      if (userRank === 0) userRank = "Non classificato";
      
      let desc = top10.length > 0 
          ? top10.map((entry, index) => `${index + 1}. <@${entry[0]}> - **${entry[1]}** 🪙`).join('\n')
          : "Nessun dato economico registrato finora.";
      
      const embed = new EmbedBuilder()
          .setTitle("🏆 LEADERBOARD EMBERCOIN")
          .setDescription(desc)
          .setColor("#eab308")
          .addFields({ name: 'La tua posizione', value: `Sei **#${userRank}** con **${userCoins}** EmberCoin.` });
          
      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'slots') {
      const scommessa = options.getInteger('scommessa');
      const userCoins = ecoCoins.get(user.id) || 0;

      if (scommessa <= 0) {
        return interaction.reply({ content: '❌ La scommessa deve essere maggiore di 0.', ephemeral: true });
      }
      if (userCoins < scommessa) {
        return interaction.reply({ content: `❌ Non hai abbastanza EmberCoin. Bilancio attuale: **${userCoins}** 🪙`, ephemeral: true });
      }

      const icone = ['🍎', '💎', '🍀', '🔥', '👑'];
      const r1 = icone[Math.floor(Math.random() * icone.length)];
      const r2 = icone[Math.floor(Math.random() * icone.length)];
      const r3 = icone[Math.floor(Math.random() * icone.length)];

      let risultatoTesto = "";
      let vincita = 0;
      let coloreEmbed = "#ef4444"; 

      if (r1 === r2 && r2 === r3) {
        vincita = scommessa * 4;
        coloreEmbed = "#22c55e";
        risultatoTesto = `🎉 **JACKPOT!** Hai trovato tre simboli uguali! Moltiplicatore **x4**.\nHai vinto **${vincita} EmberCoin**!`;
        ecoCoins.set(user.id, userCoins + (vincita - scommessa));
      } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        vincita = Math.floor(scommessa * 1.5);
        coloreEmbed = "#eab308";
        risultatoTesto = `✨ **Quasi Jackpot!** Due simboli uguali! Moltiplicatore **x1.5**.\nHai vinto **${vincita} EmberCoin**!`;
        ecoCoins.set(user.id, userCoins + (vincita - scommessa));
      } else {
        risultatoTesto = `😭 **Hai perso!** Nessun simbolo corrisponde. Hai perso **${scommessa} EmberCoin**.`;
        ecoCoins.set(user.id, userCoins - scommessa);
      }

      const nuovoBilancio = ecoCoins.get(user.id);
      const embedSlots = new EmbedBuilder()
        .setTitle('🎰 EMBERMC SLOT MACHINE')
        .setDescription(` Guadagni e perdite in tempo reale.\n\n**[ ${r1} | ${r2} | ${r3} ]**\n\n${risultatoTesto}\n\n🪙 Nuovo Bilancio: **${nuovoBilancio}** EmberCoin.`)
        .setColor(coloreEmbed)
        .setTimestamp();

      return interaction.reply({ embeds: [embedSlots] });
    }

    if (commandName === 'compito') {
      const targetUser = options.getUser('player');
      const desc = options.getString('descrizione');
      return interaction.reply({ content: `✅ Compito assegnato con successo a ${targetUser}:\n📝 **Dettagli:** ${desc}` });
    }

    if (commandName === 'set') {
      const targetUser = options.getUser('player');
      const amount = options.getInteger('monete');
      ecoCoins.set(targetUser.id, amount);
      return interaction.reply({ content: `✅ Hai impostato correttamente **${amount} EmberCoin** per il player ${targetUser}.` });
    }

    if (commandName === 'top-messaggi') {
      const allMsg = Array.from(statMessaggi.entries());
      const sorted = allMsg.sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (sorted.length === 0) return interaction.reply({ content: "Nessun dato registrato per questo mese." });
      let str = sorted.map((entry, index) => `${index + 1}. <@${entry[0]}> - **${entry[1]}** messaggi`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🏆 TOP 10 CHAT MENSILE").setDescription(str).setColor("#ea580c")] });
    }

    if (commandName === 'top-vocale') {
      const allVocale = Array.from(statVocale.entries());
      const sorted = allVocale.sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (sorted.length === 0) return interaction.reply({ content: "Nessun dato registrato per questo mese." });
      let str = sorted.map((entry, index) => {
        const min = Math.floor(entry[1] / 60000);
        return `${index + 1}. <@${entry[0]}> - **${min}** minuti`;
      }).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🏆 TOP 10 VOCALE MENSILE").setDescription(str).setColor("#ea580c")] });
    }

    if (commandName === 'testo') {
      const targetChannel = options.getChannel('canale');
      const tipo = options.getString('tipo');
      const contenuto = options.getString('contenuto').replace(/\\n/g, '\n');
      const titolo = options.getString('titolo');

      if (!targetChannel.isTextBased()) {
        return interaction.reply({ content: '❌ Seleziona un canale testuale valido.', ephemeral: true });
      }

      if (tipo === 'normale') {
        await targetChannel.send({ content: contenuto });
      } else if (tipo === 'embed') {
        const embedMsg = new EmbedBuilder()
          .setDescription(contenuto)
          .setColor('#ea580c');
        if (titolo) embedMsg.setTitle(titolo);
        await targetChannel.send({ embeds: [embedMsg] });
      }
      return interaction.reply({ content: `✅ Messaggio inviato correttamente in ${targetChannel}.`, ephemeral: true });
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
      return interaction.reply({ content: "❌ Impossibile applicare il mute. Controlla il formato della durata (es: 10m, 2h).", ephemeral: true });
    }

    if (commandName === 'ban') {
      const targetUser = options.getUser('player');
      const motivo = options.getString('motivo');
      const durability = options.getString('durata');
      await guild.members.ban(targetUser.id, { reason: motivo });
      const lista = userPunizioni.get(targetUser.id) || [];
      lista.push({ tipo: "ban", motivo: motivo, durata: durability });
      userPunizioni.set(targetUser.id, lista);
      return interaction.reply({ content: `🔴 Ban eseguito su ${targetUser.username}. Durata: ${durability}` });
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

    if (commandName === 'userinfo') {
      const targetUser = options.getUser('player');
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      
      const coins = ecoCoins.get(targetUser.id) || 0;
      const warnCount = userWarns.get(targetUser.id) || 0;
      const messaggi = statMessaggi.get(targetUser.id) || 0;
      const minutiVocale = Math.floor((statVocale.get(targetUser.id) || 0) / 60000);
      const ticketAperti = userTicketHistory.get(targetUser.id)?.length || 0;

      const embedInfo = new EmbedBuilder()
        .setAuthor({ name: `Informazioni Utente: ${targetUser.tag}`, iconURL: targetUser.displayAvatarURL() })
        .setColor('#ea580c')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '🆔 ID Utente', value: `\`${targetUser.id}\``, inline: true },
          { name: '📆 Account Creato', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '📥 Entrato nel Server', value: targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : 'Non presente', inline: true },
          { name: '🪙 EmberCoin', value: `**${coins}**`, inline: true },
          { name: '⚠️ Ammonizioni (Warn)', value: `**${warnCount}/3**`, inline: true },
          { name: '🎫 Ticket Totali', value: `**${ticketAperti}**`, inline: true },
          { name: '💬 Messaggi Mese', value: `**${messaggi}**`, inline: true },
          { name: '🔊 Tempo in Vocale', value: `**${minutiVocale} minuti**`, inline: true }
        )
        .setFooter({ text: 'EmberMC Staff Administration' })
        .setTimestamp();

      return interaction.reply({ embeds: [embedInfo], ephemeral: true });
    }

    if (commandName === 'tag') {
      const scelta = options.getString('nome_tag');
      
      const dizionarioTags = {
        reset_pass: "⚙️ **RESET PASSWORD**\nPer poter effettuare il reset della password del tuo account SP, ti chiediamo gentilmente di allegare qui sotto uno screenshot intero del tuo launcher Premium o la ricevuta d'acquisto originale del gioco. Un amministratore provvederà al reset il prima possibile.",
        store_mancato: "🛒 **MANCATO ARRIVO ACQUISTO**\nGli acquisti sullo Store possono richiedere fino a 15 minuti per essere elaborati in gioco. Se è già passato questo lasso di tempo, fornisci la ricevuta d'acquisto arrivata sulla tua email e specifica il tuo nickname esatto di gioco.",
        cheat_prove: "⚠️ **SEGNALAZIONE CHEATER**\nGrazie per la tua segnalazione. Per procedere con la sanzione dell'utente segnalato, è strettamente necessario allegare una prova video chiara e non modificata. Non accettiamo screenshot per segnalazioni di cheat.",
        richiesta_unban: "🔨 **RICHIESTA UNBAN / UNMUTE**\nSe ritieni che la sanzione applicata sul tuo account sia ingiusta, spiega dettagliatamente la tua versioni dei fatti. Lo staffer che ha applicato la sanzione esaminerà la tua richiesta ed esprimerà un verdetto definitivo.",
        candidature_staff: "💼 **CANDIDATURE STAFF**\nLe candidature per entrare a far parte del nostro Staff sono attualmente gestite tramite i canali dedicati o durante i provini ufficiali. Rimani sintonizzato nei canali degli annunci per non perdere le date di apertura dei moduli.",
        candidature_media: "🎥 **REQUISITI MEDIA (YOUTUBE/TWITCH/TIKTOK)**\nPer ottenere il rank Media su EmberMC devi soddisfare i requisiti minimi scritti nel canale informazioni. Se ritieni di soddisfarli, allega il link del tuo canale e le ultime statistiche di visualizzazioni.",
        segnalazione_bug: "🐛 **SEGNALAZIONE BUG**\nTi ringraziamo per haber riscontrato questa anomalia. Descrivi dettagliatamente come riprodurre il bug e, se possibile, allega un video o uno screenshot. Il reparto tecnico si metterà al lavoro per risolverlo.",
        transfer_account: "🔄 **TRASFERIMENTO ACCOUNT**\nIl trasferimento di statistiche, inventari o pacchetti acquistati da un account a un altro è consentito solo in casi eccezionali. Fornisci le prove di proprietà di entrambi i nickname per consentire le verifiche dei gestori.",
        lag_connessione: "🌐 **PROBLEMI DI LAG / CONNESSIONE**\nSe stai riscontrando problemi di stabilità, prova a riavviare il router o a cambiare versione di Minecraft (consigliamo l'uso della versione nativa del server con Optifine o Sodium). Se il problema persiste, fornisci un report MTR.",
        furto_survival: "🏕️ **FURTO O GRIEF IN SURVIVAL**\nTi ricordiamo che nelle zone non protette tramite claim il griefing e il furto sono dinamiche di gioco. Se l'infrazione è avvenuta all'interno di una zona correttamente claimata, fornisci le coordinate esatte (`X`, `Y`, `Z`) per i controlli dei log.",
        rimborso_bug: "💰 **RICHIESTA RIMBORSO ITEM**\nIl server non effettua rimborsi di oggetti persi a causa di morti regolari o disattenzioni. Se la perdita è derivata da un bug palese del server, allega una prova video antecedente e successiva all'evento.",
        tossicita_chat: "💬 **COMPORTAMENTO TOSSICO / INSULTI**\nIl rispetto reciproco è alla base della nostra community. Allega uno screenshot chiaro e non tagliato della chat di gioco in cui si vedono gli insulti, comprensivo di timestamp. Prenderemo provvedimenti immediati.",
        info_provini: "🎙️ **INFORMAZIONI SUI PROVINI VOCALI**\nI provini vocali vengono annunciati con largo anticipo. Assicurati di avere un microfono funzionante, un'età minima consona e una buona conoscenza del regolamento del server prima di presentarti nella stanza d'attesa.",
        abuso_staff: "⚖️ **SEGNALAZIONE ABUSO STAFF**\nPrendiamo molto sul serio la condotta dei nostri collaboratori. Se ritieni che uno staffer abbia abusato dei suoi poteri, descrivi la situazione inserendo date, orari e prove tangibili. Questo ticket verrà letto solo dall'amministrazione.",
        store_duplicato: "🧾 **ACQUISTO DUPLICATO**\nSe hai pagato due volte per lo stesso identico pacchetto per errore, non aprire una pratica di disputa su PayPal o Stripe, pena il ban automatico. Fornisci qui i due ID di transazione per ricevere il rimborso diretto.",
        info_builder: "🧱 **CANDIDATURA BUILDER**\nSei un costruttore? Per candidarti nel Team Builder di EmberMC, invia qui sotto un portfolio fotografico dei tuoi lavori migliori o dei video di strutture interamente realizzate da te, indicando da quanto tempo buildi.",
        problemi_login: "🔑 **PROBLEMI DI AUTENTICAZIONE**\nSe ricevi errori del tipo 'Sessione non valida' o 'Impossibile verificare il nome utente', prova a riavviare il tuo client di gioco o ad effettuare il logout e login dal tuo launcher ufficiale di Minecraft.",
        proposte_server: "💡 **PROPOSTE E SUGGERIMENTI**\nSiamo sempre felici di ascoltare la community. Esponi la tua idea in modo chiaro specificando quale modalità andrebbe a migliorare e quali sarebbero i vantaggi pratici per l'utenza.",
        candidatura_eventi: "🎁 **ORGANIZZAZIONE EVENTI**\nSei un content creator o vuoi proporre un evento speciale sul server? Spiega la struttura dell'evento, lo spazio necessario all'interno delle modalità e i premi in palio previsti per i vincitori.",
        chiusura_inattivo: "💤 **CHIUSURA TICKET PER INATTIVITÀ**\nQuesto ticket non ha ricevuto aggiornamenti da diverse ore. Per questo motivo, la pratica viene considerata risolta e archiviata. Se hai ancora bisogno di supporto, non esitare ad aprire un nuovo ticket."
      };

      const rispostaScelta = dizionarioTags[scelta];
      return interaction.reply({ content: rispostaScelta });
    }

    if (commandName === 'partner') {
      const sub = options.getSubcommand();

      if (sub === 'add') {
        const utentePartner = options.getUser('utente');
        const nomeServer = options.getString('nome');
        const linkInvito = options.getString('link');

        const currentStats = partnerStats.get(user.id) || 0;
        partnerStats.set(user.id, currentStats + 1);

        const embedPartner = new EmbedBuilder()
          .setTitle(`🤝 NUOVA PARTNERSHIP: ${nomeServer.toUpperCase()}`)
          .setDescription(`EmberMC ha stretto una nuova collaborazione con **${nomeServer}**!\n\n**👤 Rappresentante:** ${utentePartner}\n🔗 **Link d'Invito:** ${linkInvito}\n\n*Partnership registrata da lo staffer: ${user}*`)
          .setColor('#22c55e')
          .setTimestamp();

        return interaction.reply({ embeds: [embedPartner] });
      }

      if (sub === 'stats') {
        const staffer = options.getUser('staffer');
        const count = partnerStats.get(staffer.id) || 0;
        return interaction.reply({ content: `📊 Lo staffer ${staffer} ha completato e registrato **${count}** partnership complessive.`, ephemeral: true });
      }

      if (sub === 'verificare') {
        const link = options.getString('link');
        if (!link.includes('discord.gg') && !link.includes('discord.com/invite')) {
          return interaction.reply({ content: '❌ Questo non sembra un link d\'invito Discord valido.', ephemeral: true });
        }
        return interaction.reply({ content: `🔎 Richiesta di controllo avviata per l'invito \`${link}\`. Lo stato verrà stampato nella console del bot.`, ephemeral: true });
      }
    }

    if (commandName === 'regala-coin') {
      const targetUser = options.getUser('player');
      const amount = options.getInteger('monete');

      if (amount <= 0) {
        return interaction.reply({ content: '❌ Inserisci una quantità di monete maggiore di 0.', ephemeral: true });
      }

      const bilancioAttuale = ecoCoins.get(targetUser.id) || 0;
      ecoCoins.set(targetUser.id, bilancioAttuale + amount);

      const embedPremio = new EmbedBuilder()
        .setTitle('🎁 PREMIO EVENTO EMBERCOIN')
        .setDescription(`Il player ${targetUser} ha ricevuto in regalo **${amount} EmberCoin** direttamente dallo Staff!\n\n🏆 **Complimenti!**`)
        .setColor('#eab308')
        .setTimestamp();

      return interaction.reply({ embeds: [embedPremio] });
    }
  }

  // ==========================================
  // 🔘 GESTIONE BOTTONI DEI TICKET
  // ==========================================
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
